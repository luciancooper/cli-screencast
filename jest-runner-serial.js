// eslint-disable-next-line import/no-extraneous-dependencies
const JestRunner = require('jest-runner').default;

module.exports = class JestRunnerSerial extends JestRunner {
    constructor(...args) {
        super(...args);
        this.isSerial = true;
    }
};