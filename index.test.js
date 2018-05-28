const AWS = require('aws-sdk')
const highland = require('highland')
const sinon = require('sinon')
const {expect} = require('chai')
const sinonChai = require('sinon-chai')
require('chai').use(sinonChai)

const sqsWrapper = require('./index')
const {recieveMessagesStream, receiveMessages} = require('./index')

describe('Unit::lib/sqs module', () => {
  let sandbox
  const queueUrl = 'http://my.queue.com'

  beforeEach(() => {
    sandbox = sinon.createSandbox()
  })

  afterEach(() => {
    sandbox.restore()
  })

  describe('receiveMessages', () => {
    let sqsStub
    let actualParams

    beforeEach(() => {
      sqsStub = sandbox.stub(AWS, 'SQS')
    })

    test('should return a rejected promise when sqs receive error occurs', () => {
      sqsStub.returns({
        receiveMessage(params, cb) {
          actualParams = params
          cb(new Error('Bad Credentials'), null)
        },
      })

      return receiveMessages(queueUrl)
        .then(() => expect.fail('Should not have been resolved.'))
        .catch((err) => {
          expect(actualParams.QueueUrl).to.equal(queueUrl)
          expect(actualParams.MaxNumberOfMessages).to.equal(10)
          expect(actualParams.VisibilityTimeout).to.equal(60)
          expect(actualParams.WaitTimeSeconds).to.equal(2)
          expect(err.message).to.equal('Bad Credentials')
        })
    })

    test('should return a resolved promise with empty array of messages when sqs has no null messages', () => {
      sqsStub.returns({
        receiveMessage(params, cb) {
          actualParams = params
          cb(null, {})
        },
      })

      return receiveMessages(queueUrl)
        .then((messages) => {
          expect(messages).to.have.length(0)
        })
    })

    test('should return a resolved promise with empty array of messages when sqs has no empty messages array', () => {
      sqsStub.returns({
        receiveMessage(params, cb) {
          actualParams = params
          cb(null, {Messages: []})
        },
      })

      return receiveMessages(queueUrl)
        .then((messages) => {
          expect(messages).to.have.length(0)
        })
    })

    test('should return a resolved promise with array of messages when sqs has messages to receive', () => {
      sqsStub.returns({
        receiveMessage(params, cb) {
          actualParams = params
          cb(null, {
            Messages: [{
              MessageId: '1',
              ReceiptHandle: 'handle_for_1',
              Body: '{"eventType":"event_1", "bucket":"bucket_1"}'
            }, {
              MessageId: '2',
              ReceiptHandle: 'handle_for_2',
              Body: '{"eventType":"event_2", "bucket":"bucket_2"}'
            }],
          })
        },
      })

      return receiveMessages(queueUrl)
        .then((messages) => {
          expect(messages).to.have.length(2)
          expect(messages[0]).to.eql({
            MessageId: '1',
            ReceiptHandle: 'handle_for_1',
            Body: '{"eventType":"event_1", "bucket":"bucket_1"}'
          })
          expect(messages[1]).to.eql({
            MessageId: '2',
            ReceiptHandle: 'handle_for_2',
            Body: '{"eventType":"event_2", "bucket":"bucket_2"}'
          })
        })
    })
  })

  describe('recieveMessagesStream', () => {
    let receiveMessagesStub

    beforeEach(() => {
      receiveMessagesStub = sandbox.stub(sqsWrapper, 'receiveMessages')
    })

    test('should stream all readable messages', () => {
      receiveMessagesStub.withArgs(queueUrl)
        .onFirstCall()
        .resolves([{id: 1}, {id: 2}])
        .onSecondCall()
        .resolves([{id: 3}, {id: 4}, {id: 5}])
        .onThirdCall()
        .resolves([])
      const receivedMessages = []

      return new Promise((resolve, reject) => {
        highland(recieveMessagesStream(queueUrl))
          .errors(err => reject(err))
          .each(message => receivedMessages.push(message))
          .done(() => {
            expect(receiveMessagesStub).to.have.callCount(4)
            expect(receivedMessages).to.have.length(5)
            resolve()
          })
      })
    })

    test('should attempt to receive messages until maxEmptyRecieves is breached', () => {
      receiveMessagesStub.withArgs(queueUrl)
        .onFirstCall()
        .resolves([{id: 1}, {id: 2}])
        .onSecondCall()
        .resolves([])
      const receivedMessages = []

      return new Promise((resolve, reject) => {
        highland(recieveMessagesStream(queueUrl, {maxEmptyRecieves: 5}))
          .errors(err => reject(err))
          .each(message => receivedMessages.push(message))
          .done(() => {
            expect(receiveMessagesStub).to.have.callCount(7)
            expect(receivedMessages).to.have.length(2)
            resolve()
          })
      })
    })

    test('should handle errors and stop reading messages when error occur', () => {
      receiveMessagesStub.withArgs(queueUrl)
        .onFirstCall()
        .resolves([{id: 1}, {id: 2}])
        .onSecondCall()
        .rejects(new Error('QUEUE DOWN'))
      const receivedMessages = []
      const errors = []

      return new Promise((resolve) => {
        highland(recieveMessagesStream(queueUrl))
          .errors(err => errors.push(err))
          .each(message => receivedMessages.push(message))
          .done(() => {
            expect(receivedMessages).to.have.length(2)
            expect(errors).to.have.length(1)
            expect(errors[0].message).to.equal('QUEUE DOWN')
            resolve()
          })
      })
    })
  })
})
