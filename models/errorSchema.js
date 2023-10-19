const mongoose = require('mongoose');

const errorSchema = new mongoose.Schema({
    tag: { type: String, require: true },
    user: { type: String, require: true },
    guild: { type: String, require: true },
    channel: { type: String, require: true },
    command: { type: String, require: true },
    timestamp: { type: String, require: true },
    error : {
        code: { type: String, require: true },
        message: { type: String, require: true }
    }
    
})

const model = mongoose.model('errorModels', errorSchema);

module.exports = model;