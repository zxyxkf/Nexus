module.exports = {
  ...require('./record.service'),
  ...require('./workflow.service'),
  ...require('./open.service'),
  imageService: require('./image.service')
};
