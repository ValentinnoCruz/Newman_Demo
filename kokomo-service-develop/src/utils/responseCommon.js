
const StatusCode = {
  OK: 200,
  Err_500: 500,
  Err_503: 503,
  Err_400: 400,
  Err_401: 401,
  Err_403: 403,
  Err_404: 404,
}
// ok
const ok = (message) => ({
  statusCode: StatusCode.OK,
  message: message || 'OK'
})

// Err - common
const err_500 = (message) =>({
  statusCode: StatusCode.Err_500,
  message: message || 'Unexpected server error'
})

const err_503 = (message) => ({
  statusCode: StatusCode.Err_503,
  message: message || 'Service Unavailable error'
})

const err_400 = (message) => ({
  statusCode: StatusCode.Err_400,
  message: message || 'Bad Request'
})

const err_401 = (message) => ({
  statusCode: StatusCode.Err_401,
  message: message || 'Unauthorized'
})
const err_403 = (message) => ({
  statusCode: StatusCode.Err_403,
  message: message || 'Forbidden Access'
})

const err_404 = (message) => ({
  statusCode: StatusCode.Err_404,
  message: message || 'Not Found'
})

module.exports = {
  ok,
  err_500,
  err_503,
  err_400,
  err_401,
  err_403,
  err_404,
  StatusCode,
}
