const admin = require('firebase-admin');
const serviceAccount = require('./serviceKey.json');

admin.initializeApp({
	credential: admin.credential.cert(serviceAccount),
	databaseURL: 'https://my-project.firebaseio.com'
});

const db = admin.firestore();
module.exports = { admin, db };
