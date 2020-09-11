const fetch = require('node-fetch')

const SPSP_PROXY = 'ENV_SPSP_PROXY'
const PROXY_API = 'ENV_PROXY_API'
const VERIFIER = 'ENV_VERIFIER'

Vue.component('create', {
  template: `
    <div>
      <p>
        Create a proxy payment pointer. Your payment pointer is hashed and the result is used as your proxy.
      <p>
      <form class="create-form" @submit.prevent="onSubmit">

        <div class="row">
          <div class="twelve columns">
            <label for="paymentPointer">Payment Pointer</label>
            <input class="u-full-width" id="paymentPointer" v-model="paymentPointer" type="text" placeholder="$test.spsp.example.com" required>
          </div>
        </div>
        <div class="row">
          <input type="submit" name="submit" value="Submit">
          <button v-on:click="reset">Reset</button>
        </div>
      </form>
      <div v-show="proxyPointer !== null">
        <p>
          Your proxy pointer is: <strong>{{ proxyPointer }}</strong>
        </p>
        <p>
          The verifier endpoint is: <strong>${VERIFIER}/</strong>
        </p>
      </div>
    </div>
    `,
  data () {
    return {
      paymentPointer: null,
      proxyPointer: null
    }
  },
  methods: {
    onSubmit () {
      fetch(`${PROXY_API}/proxy`, 
      { 
        method: 'POST', 
        body: JSON.stringify({ paymentPointer: this.paymentPointer }), 
        headers: { 'Content-Type': 'application/json' }
      }).then(res => {
        if (!res.ok) {
          console.log(`Proxy creation error: ${res.status} ${res.statusText}`)
        } else {
          return res
        }
      }).then(res => res.json())
        .then(json => {
          this.proxyPointer = `${SPSP_PROXY}/${json.proxy}`
        })
    },
    reset () {
      this.paymentPointer = null
      this.proxyPointer = null
    }
  }

})

Vue.component('test', {
  template: `
  <div>
      <p>
        Test your proxy payment pointer. Paste it into the field and you will stream until 5 receipts have been received. 
        The receipts are displayed on the bottom.
      <p>
      <form class="test-form" @submit.prevent="onSubmit">

        <div class="row">
          <div class="twelve columns">
            <label for="proxyPointer">Proxy Payment Pointer</label>
            <input class="u-full-width" id="proxyPointer" v-model="proxyPointer" type="text" placeholder="https://spsp.example.com/38e67df1d9ce773b3ef7b6307736bd8ce98953ac2846ea1613aed1781bb2c849" required>
          </div>
        </div>
        <div class="row">
          <input type="submit" value="Submit">
          <button v-on:click="reset">Reset</button>
        </div>
      </form>
      <div v-show="monetization === false">
        <p>
          You need to enable your Web Monetization provider's extension.
        </p>
      </div>
      <div v-show="validProxy === false">
        <p>
          Your proxy pointer was not set up correctly.
        </p>
      </div>
      <div v-show="requestId !== null">
      <p><strong>Proxy pointer works as expected.</strong></p>
      <p>Request id: {{ requestId }}</p>
      <p>Receipts:</p>
      <ul v-for="(receipt, index) in receipts">
        <li>{{ receipt }}</li>
      </ul>
    </div>
    </div>
  `,
  data () {
    return {
      proxyPointer: null,
      monetization: null,
      validProxy: null,
      requestId: null,
      receipts: []
    }
  },
  methods: {
    onSubmit () {
      this.addMeta()
      if (document.monetization) {
        this.monetization = true
        document.monetization.addEventListener('monetizationstop', () => {
          if (this.receipts.length < 1 ){
            this.validProxy = false
          }
        })
        document.monetization.addEventListener('monetizationprogress', (event) => {
          this.validProxy = true
          this.requestId = event.detail.requestId
          const receipt = event.detail.receipt
          this.receipts.push(receipt)
          if (this.receipts.length > 4) {
            this.removeMeta()
          }
        })
      } else {
        this.monetization = false
      }
    },
    addMeta() {
      const meta = document.createElement('meta')
      meta.name = 'monetization'
      meta.content = this.proxyPointer
      document.getElementsByTagName('head')[0].appendChild(meta)
    },
    removeMeta() {
      const meta = document.getElementsByName("monetization")[0]
      meta.remove()
    },
    reset () {
      this.proxyPointer = null
      this.monetization = null
      this.validProxy = null
      this.requestId = null
      this.receipts = []
    }
  }
})

Vue.component('delete', {
  template: `
  <div>
      <p>
        Delete your proxy payment pointer. If you don't need your proxy payment pointer anymore, you can delete it 
        by submitting it here. After deletion, feel free to test again. You should receive an error message. 
      <p>
      <form class="delete-form" @submit.prevent="onSubmit">

        <div class="row">
          <div class="twelve columns">
            <label for="proxyPointer">Proxy Payment Pointer</label>
            <input class="u-full-width" id="proxyPointer" v-model="proxyPointer" type="text" placeholder="https://spsp.example.com/38e67df1d9ce773b3ef7b6307736bd8ce98953ac2846ea1613aed1781bb2c849" required>
          </div>
        </div>
        <div class="row">
          <input type="submit" value="Submit">
          <button v-on:click="reset">Reset</button>
        </div>
      </form>
      <div v-show="deleted">
        <p>
          <strong>Your proxy pointer has been successfully deleted.</strong>
        </p>
      </div>
    </div>
  `,
  data () {
    return {
      proxyPointer: null,
      deleted: null
    }
  },
  methods: {
    onSubmit () {
      const proxy = this.proxyPointer.split('/').pop();
      fetch(`${PROXY_API}/proxy/${proxy}`, 
      { 
        method: 'DELETE', 
      }).then(res => {
        if (!res.ok) {
          this.deleted = false
          console.log(`Proxy deletion error: ${res.status} ${res.statusText}`)
        } else {
          this.deleted = true
        }
      })
    },
    reset () {
      this.proxyPointer = null
      this.deleted = null
    }
  }
})

Vue.component('tabs', {
  template: `
    <div>
    
      <ul>
        <span class="tabs button" 
              :class="{ 'button-primary': selectedTab === tab }"
              v-for="(tab, index) in tabs"
              @click="selectedTab = tab"
              :key="tab"
        >{{ tab }}</span>
      </ul>

      <div v-show="selectedTab === 'Create'">
        <create></create>
      </div> 

      <div v-show="selectedTab === 'Test'">
        <test></test>
      </div>

      <div v-show="selectedTab === 'Delete'">
        <delete></delete>
      </div>
  
    </div>
  `,
  data () {
    return {
      tabs: ['Create', 'Test', 'Delete'],
      selectedTab: 'Create',
    }
  },
})

var app = new Vue({
  el: '#app',
  data: {

  },
  methods: {
  }
})
