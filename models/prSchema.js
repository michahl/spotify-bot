const mongoose = require('mongoose');

const prSchema = new mongoose.Schema({
    userID: { type: String, require: true},
    spUserID: { type: String, require: true, default: null},
    access_token: { type: String, require: true, default: null},
    refresh_token: { type: String, require: true, default: null}
})

const model = mongoose.model('prModels', prSchema);

module.exports = model;