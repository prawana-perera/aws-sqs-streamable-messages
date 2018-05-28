const highland = require('highland')

const AWS = require('aws-sdk') // eslint-disable-line
const AWS_REGION = process.env.AWS_REGION || 'ap-southeast-2'

const DEFAULT_RECEIVE_MSGS_STREAM_OPTS = {
  maxEmptyRecieves: 1
}

exports.recieveMessagesStream = (queueUrl, opts) => {
  const {maxEmptyRecieves, endStream} = Object.assign({}, DEFAULT_RECEIVE_MSGS_STREAM_OPTS, opts)
  let numEmptyReceives = 0

  return highland(async (push, next) => {
    try {
      const receivedMessages = await exports.receiveMessages(queueUrl)
      if (!receivedMessages || !receivedMessages.length) {
        numEmptyReceives += 1

        if (numEmptyReceives > maxEmptyRecieves) {
          push(null, highland.nil)
        } else {
          next()
        }
      } else {
        numEmptyReceives = 0
        receivedMessages.forEach(message => push(null, message))
        next()
      }
    } catch (err) {
      push(err)
      push(null, highland.nil)
    }
  }).toNodeStream({objectMode: true})
}

exports.receiveMessages = queueUrl => new Promise((resolve, reject) => {
  const sqs = new AWS.SQS({apiVersion: 'latest', region: AWS_REGION})
  const params = {
    QueueUrl: queueUrl,
    MaxNumberOfMessages: 10,
    VisibilityTimeout: 60, // seconds - how long we want the message to be invisible to others
    WaitTimeSeconds: 2, // seconds - how long should we wait for a message
  }

  sqs.receiveMessage(params, (err, data) => {
    if (err) {
      reject(err)
    } else {
      resolve(data.Messages || [])
    }
  })
})
