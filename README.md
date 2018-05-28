# aws-sqs-streamable-messages
A demo project to receive AWS SQS messages as a readable stream

This demonstration useing the highlandjs library to work easily with NodeJS Streams.

Functions used:
* index.receiveMessages - this function is a light wrapper around the AWS SQS receiveMessage function
* index.recieveMessagesStream - this function uses the above function in a highlandjs generator function to emit SQS messages into a stream. It returns a NodeJS Stream to the calling code. Since SQS may get empty received, a max empty receives parameter is also implemented.

## TODO:
- [ ] Implement this is pure NodeJS Stream to constrast