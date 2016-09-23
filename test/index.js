'use strict'

const chai = require('chai')
const sinon = require('sinon')

const expect = chai.expect

const RabbitMQTransport = require('../lib/index')

const RABBITMQ_SERVER_URL = 'amqp://rabbitmq-server:5672'

describe('RabbitMQ Transport', () => {
  describe('listen()', () => {
    it('should throw error if service does not have `onMessage` method', () => {
      expect(() => new RabbitMQTransport({ url: RABBITMQ_SERVER_URL }).listen({})).to.throw()
    })

    it('should return promise', () => {
      expect(new RabbitMQTransport({ url: RABBITMQ_SERVER_URL }).listen({ onMessage: () => 1 })).to.be.instanceOf(Promise)
    })

    it('should return connection config', (done) => {
      new RabbitMQTransport({ url: RABBITMQ_SERVER_URL }).listen({ onMessage: () => 1 })
        .then((connectionConfig) => {
          expect(connectionConfig).to.have.all.keys([ 'address', 'queueName' ])

          done()
        })
    }).timeout(10 * 1000)
  })

  describe('send()', () => {
    let amqp

    afterEach(() => {
      if (amqp && amqp.connect && amqp.connect.restore) {
        amqp.connect.restore()
      }
    })

    it('should connecting once', (done) => {
      let connectSpy
      const messages = []

      const service = {
        serviceName: 'connecting_once',
        onMessage: (message, reply) => {
          messages.push(message)

          if (messages.length === 3) {
            expect(connectSpy.calledOnce).to.be.true

            done()
          }

          reply(null, { result: 'ok' })
        }
      }

      new RabbitMQTransport({ url: RABBITMQ_SERVER_URL }).listen(service)
        .then((connectionConfig) => {
          delete require.cache[ require.resolve('amqplib') ]
          delete require.cache[ require.resolve('../lib/index') ]

          amqp = require('amqplib')
          connectSpy = sinon.spy(amqp, 'connect')

          const RabbitMQTransportFresh = require('../lib/index')

          const client = new RabbitMQTransportFresh()

          client.send(connectionConfig, {}, () => {
          })

          client.send(connectionConfig, {}, () => {
          })

          client.send(connectionConfig, {}, () => {
          })
        })
    }).timeout(10 * 1000)

    it('should reused one connection', (done) => {
      const service = {
        serviceName: 'reused',
        onMessage: (message, reply) => {
          reply(null, { result: 'ok' })
        }
      }

      new RabbitMQTransport({ url: RABBITMQ_SERVER_URL }).listen(service)
        .then((connectionConfig) => {
          delete require.cache[ require.resolve('amqplib') ]
          delete require.cache[ require.resolve('../lib/index') ]

          amqp = require('amqplib')
          const connectSpy = sinon.spy(amqp, 'connect')

          const RabbitMQTransportFresh = require('../lib/index')

          const client = new RabbitMQTransportFresh()

          client.send(connectionConfig, {}, () => {
            client.send(connectionConfig, {}, () => {
              expect(connectSpy.calledOnce).to.be.true

              done()
            })
          })
        })
    }).timeout(10 * 1000)
  })

  describe('communication', () => {
    it('client should be able to communication with server ', (done) => {
      const service = {
        serviceName: 'communication',
        onMessage: (message, reply) => {
          expect(message.a).to.be.equal(1)

          reply(null, { result: 'ok' })
        }
      }

      const client = new RabbitMQTransport()

      new RabbitMQTransport({ url: RABBITMQ_SERVER_URL }).listen(service)
        .then((connectionConfig) => {
          client.send(connectionConfig, { a: 1 }, (error, response) => {
            expect(response.result).to.be.equal('ok')

            done()
          })
        })
    }).timeout(10 * 1000)
  })
})
