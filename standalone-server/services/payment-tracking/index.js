module.exports = {
  ...require('./record.service'),
  ...require('./workflow.service'),
  imageService: require('./image.service')
};
