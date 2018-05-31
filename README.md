# aws-sqs-streamable-messages
A demo project to receive AWS SQS messages as a readable stream

This demonstration useing the highlandjs library to work easily with NodeJS Streams.

Functions used:
* index.receiveMessages - this function is a light wrapper around the AWS SQS receiveMessage function
* index.recieveMessagesStream - this function uses the above function in a highlandjs generator function to emit SQS messages into a stream. It returns a NodeJS Stream to the calling code. Since SQS may get empty received, a max empty receives parameter is also implemented.

## Use cases

# Implement a simple event driven architecture
![Alt SNS and SQS](/docs/aws-sqs-streamable-messages-lambda-usecase.jpg?raw=true "Event processing using SNS and SQS")

In this simple architecture we are using an SNS topic (which some upstream process/system publishes events to). We subscribe a queue to this topic. We are using lambdas to process the events.

The processing step is broken into two parts, consumption of the event and processing of the event. We label the lambdas as `Consumer Lambda` and `Worker Lambda`.

The consumer is responsible for merely reading the events from the queue and invoking a worker for each event. The worker is responsible for processing the event (heavy lifting) as well as deleting the event from the queue if it was able to successfully process the event.

This design allows us to parrallel process the events by horizontally scalling the workers. Reading the messages as a stream and performing worker invocations in a stream allows us to accomplish this in a asynchronous fashion and allows us to achieve high throughput.

See [index.js](index.js) for the implementation using a streaming SQS messages. TBA.

## TODO:
- [ ] Implement this is pure NodeJS Stream to constrast