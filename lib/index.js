'use strict'

const amqp = require('amqplib')

const utils = require('microscopic-utils')
const Asserts = utils.asserts
const Json = utils.json
const Random = utils.random

const Transport = require('microscopic-transport')

const _connections = Symbol('connections')
const _queueMessages = Symbol('queueMessages')

const DEFAULT_OPTIONS = {
  loadbalancing: false,
  url: 'amqp://127.0.0.1:5672'
}

class RABBITMQTransport extends Transport {
  constructor (options) {
    super(options)

    this.options = Object.assign({}, DEFAULT_OPTIONS, this.options)

    this[ _connections ] = new Map()
    this[ _queueMessages ] = []
  }

  /**
   * @inheritDoc
   */
  listen (service) {
    Asserts.assert(typeof service.onMessage === 'function', new TypeError('Does not have `onMessage` method'))

    const queueName = `${service.serviceName}_queue`

    return new Promise((resolve) => {
      this._connect(this.options.url)
        .then((connection) => connection.createChannel())
        .then((channel) => {
          channel.prefetch(1)
          channel.assertQueue(queueName, { durable: false })

          const onMessage = (msg) => {
            const message = Json.parse(msg.content)

            const reply = (error, response) => channel.sendToQueue(msg.properties.replyTo,
              new Buffer(Json.stringify(
                {
                  id: message.id,
                  result: response
                }
              )),
              { correlationId: msg.properties.correlationId })

            service.onMessage(message, reply)

            channel.ack(msg)
          }

          return channel.consume(queueName, onMessage)
        })
        .then(() => resolve({ address: this.options.url, queueName: queueName }))
    })
  }

  /**
   * @inheritDoc
   */
  send (connectionConfig, msg, callback) {
    const message = super.createMessage(msg, callback)

    if (this.channel) {
      return this._send(message, connectionConfig.queueName)
    }

    this[ _queueMessages ].push(message)

    if (this.connecting) {
      return
    }

    this.connecting = true

    return this._connect(connectionConfig.address)
      .then((connection) => connection.createChannel())
      .then((channel) => {
        return channel.assertQueue('')
          .then((queue) => {
            const onMessage = (msg) => {
              super.onResponse(Json.parse(msg.content))
            }

            let connected = () => {
              this.channel = channel
              this.queue = queue.queue

              this.connecting = false

              while (this[ _queueMessages ].length > 0) {
                const msg = this[ _queueMessages ].shift()
                this._send(msg, connectionConfig.queueName)
              }
            }

            return channel.consume(queue.queue, onMessage).then(connected)
          })
      })
  }

  _connect (url) {
    const MAX_RETRIES = 15

    return new Promise((resolve, reject) => {
      _connect(MAX_RETRIES, url, resolve, reject)
    })

    function _connect (maxRetries, url, resolve, reject) {
      amqp.connect(url)
        .then(resolve)
        .catch((error) => {
          /* istanbul ignore next */
          if (maxRetries <= 0) {
            return reject(error)
          }

          setTimeout(() => {
            _connect(maxRetries - 1, url, resolve, reject)
          }, (MAX_RETRIES - maxRetries) * 500)
        })
    }
  }

  _send (message, queueName) {
    this.channel.sendToQueue(queueName,
      new Buffer(Json.stringify(message)),
      { correlationId: Random.uuid(), replyTo: this.queue })
  }
}

module.exports = RABBITMQTransport
