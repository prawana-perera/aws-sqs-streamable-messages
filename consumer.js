const highland = require('highland')

const {recieveMessagesStream} = require('./index')

const MIN_REQUIRED_EXECUTION_TIME = 15000 // milliseconds
const MAX_PARALLEL_WORKER_INVOCATIONS = 50

// Ripped from https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random
const getRandomIntInclusive = (min, max) => { 
  min = Math.ceil(min)
  max = Math.floor(max)
  return Math.floor(Math.random() * (max - min + 1)) + min //The maximum is inclusive and the minimum is inclusive 
}

// required by highland to handle errors within node streams
const streamOnFinish = (readable, callback) => {
  readable.on('error', callback)
  readable.on('finish', callback)

  return {
    onDestroy: () => {
      readable.removeListener('error', callback)
      readable.removeListener('finish', callback)
    },
    continueOnError: true,
  }
}

// fake lamnda invocation, simulate some random delay
const fakeInvokeLambda = (lamndaName, message) => new Promise(resolve => {
  setTimeout(() => resolve('lambda invoked'), getRandomIntInclusive(500, 1500))
})

exports.consumeMessages = (queueUrl, workerLambaName, endStreamFunction) => new Promise((resolve) => {
  // capture errors for later
  const errors = []
  const opts = {
    endStream: endStreamFunction,
  }

  highland(sqs.recieveMessagesStream(queueUrl, opts), streamOnFinish)
    .map((message) => highland(fakeInvokeLambda(workerLambaName, message)))
    .mergeWithLimit(MAX_PARALLEL_WORKER_INVOCATIONS) // 
    .errors((err) => {
      // absorb error and keep try to get through messages
      console.error('consumeMessages - error detected:', err.message)
      errors.push(err)
    })
    .done(() => {
      console.log('consumeMessages -finished processing available messages in queue')

      if (errors.length) {
        console.error('consumeMessages - number of errors were detected: %s', errors.length)
      }

      return resolve({
        errors,
      })
    })
})

exports.lambdaHandler = async (event, context) => {

  // if lambda is about to die soon, we should attempt to stop any further processing (if we have less than 15 seconds left)
  const endStreamFunction = () => context.getRemainingTimeInMillis() < 15000
  const result = await exports.consumeMessages('test', 'myLambda', endStreamFunction)

  if (results.errors && results.errors.length) {
    logger.error('index::handler - some error were encountered', results.errors)
  }
  return results
}
