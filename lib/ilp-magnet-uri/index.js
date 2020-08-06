const { magnetURIDecode, magnetURIEncode } = require('magnet-uri')

function ilpMagnetURIDecode (uri) {
  const result = magnetURIDecode(uri)
  result.license = {}
  if (result.pp) {
    result.pp = decodeURIComponent(result.pp)
    result.license.paymentPointer = result.pp
  }
  if (result.vr) {
    result.vr = decodeURIComponent(result.vr)
    result.license.verifier = result.vr
  }
  return result
}

function ilpMagnetURIEncode (obj) {
  let result = magnetURIEncode(obj)
  if (obj.license.paymentPointer) {
    result += `&pp=${encodeURIComponent(obj.license.paymentPointer)}`
  }
  if (obj.license.verifier) {
    result += `&vr=${encodeURIComponent(obj.license.verifier)}`
  }
  return result
}

module.exports = ilpMagnetURIDecode
module.exports.decode = ilpMagnetURIDecode
module.exports.encode = ilpMagnetURIEncode
