const functions = require('firebase-functions');
const app = require('express')();
const FBAuth = require('./util/fbAuth');
const { db } = require('./util/admin');

const {
	getAllPosts,
	makeAPost,
	getPost,
	commentOnPost,
	likePost,
	unlikePost,
	deletePost
} = require('./handlers/posts');
const {
	signup,
	login,
	uploadImage,
	addUserDetails,
	getAuthenticatedUser,
	getUserDetails,
	markNotificationsRead
} = require('./handlers/users');

// posts routes
app.get('/posts', getAllPosts);
app.post('/posts', FBAuth, makeAPost);
app.get('/posts/:postId', getPost);
app.post('/posts/:postId/comment', FBAuth, commentOnPost);
app.get('/posts/:postId/like', FBAuth, likePost);
app.get('/posts/:postId/unlike', FBAuth, unlikePost);
app.delete('/posts/:postId', FBAuth, deletePost);

// users route
app.post('/signup', signup);
app.post('/login', login);
app.post('/user/image', FBAuth, uploadImage);
app.post('/user', FBAuth, addUserDetails);
app.get('/user', FBAuth, getAuthenticatedUser);
app.get('/user/:handle', getUserDetails);
app.post('/notifications', FBAuth, markNotificationsRead);

exports.api = functions.https.onRequest(app);
exports.createNotificationOnLike = functions.firestore.document('likes/{id}').onCreate((snapshot) => {
	db.doc(`/posts/${snapshot.data().postId}`).get().then((doc) => {
		if (doc.exists && doc.data().userHandle !== snapshot.data().userHandle) {
			return db
				.doc(`/notifications/${snapshot.id}`)
				.set({
					createdAt: new Date().toISOString(),
					recipient: doc.data().userHandle,
					sender: snapshot.data().userHandle,
					type: 'like',
					read: false,
					postId: doc.id
				})
				.catch((err) => {
					console.error(err);
				});
		}
	});
});
exports.deleteNotificationOnUnLike = functions.firestore.document('likes/{id}').onDelete((snapshot) => {
	return db.doc(`/notifications/${snapshot.id}`).delete().catch((err) => {
		console.error(err);
	});
});
exports.createNotificationOnComment = functions.firestore.document('comments/{id}').onCreate((snapshot) => {
	db.doc(`/posts/${snapshot.data().postId}`).get().then((doc) => {
		if (doc.exists && doc.data().userHandle !== snapshot.data().userHandle) {
			return db
				.doc(`/notifications/${snapshot.id}`)
				.set({
					createdAt: new Date().toISOString(),
					recipient: doc.data().userHandle,
					sender: snapshot.data().userHandle,
					read: false,
					postId: doc.id,
					type: 'comment'
				})
				.catch((err) => {
					console.error(err);
				});
		}
	});
});
exports.onUserImageChange = functions.firestore.document('/users/{userId}').onUpdate((change) => {
	console.log(change.before.data());
	console.log(change.after.data());
	if (change.before.data().imageUrl !== change.after.data().imageUrl) {
		console.log('image has changed');
		const batch = db.batch();
		return db.collection('posts').where('userHandle', '==', change.before.data().handle).get().then((data) => {
			data.forEach((doc) => {
				const post = db.doc(`/posts/${doc.id}`);
				batch.update(post, { userImage: change.after.data().imageUrl });
			});
			return batch.commit();
		});
	} else return true;
});
// TODO: change to await
exports.onPostDelete = functions.firestore.document('/posts/{postId}').onDelete((snapshot, context) => {
	const postId = context.params.postId;
	const batch = db.batch();
	return db
		.collection('comments')
		.where('postId', '==', postId)
		.get()
		.then((data) => {
			data.forEach((doc) => {
				batch.delete(db.doc(`/comments/${doc.id}`));
			});
			return db.collection('likes').where('postId', '==', postId).get();
		})
		.then((data) => {
			data.forEach((doc) => {
				batch.delete(db.doc(`/notifications/${doc.id}`));
			});
			return db.collection('notifications').where('postId', '==', postId).get();
		})
		.then((data) => {
			data.forEach((doc) => {
				batch.delete(db.doc(`/notifications/${doc.id}`));
			});
			return batch.commit();
		})
		.catch((err) => console.error(err));
});
