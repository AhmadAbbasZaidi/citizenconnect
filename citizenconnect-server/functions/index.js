

const functions = require('firebase-functions');
var gcs = require('@google-cloud/storage')({keyFilename:'citizenconnect-ed5fa-firebase-adminsdk-op53u-069b5c7148.json'})
const spawn = require('child-process-promise').spawn
var FCM = require('fcm-push');
var serverKey = 'AAAAb6tZ1_Y:APA91bGU7sDMrtgMF1y_OIOWqVqMPMc_0RT25UmvUkq-RHdz9LWrd6nX4Lbjpn4RKKefu1cqO_2Cb8l9a-U5x5DMMsu6WQZ7IdYj6Mb9y8h0DsOTzUILSckywWlCFfHanESLq_rnIe0H';
var fcm = new FCM(serverKey);
const admin = require('firebase-admin')
admin.initializeApp(functions.config().firebase)
exports.generateThumbnail = functions.storage.object()
.onChange(event=>{
    const object = event.data
    const filePath = object.name
    const fileName = filePath.split('/').pop()
    const fileBucket = object.bucket
    const bucket = gcs.bucket(fileBucket)
    const tempFilePath  = `/tmp/${fileName}`
    const ref = admin.database().ref()
    const file = bucket.file(filePath)
    const thumbFilePath = filePath.replace(/(\/)?([^\/]*)$/,
    '$1thumb_$2')
    console.log('File Bucket'+fileBucket)
    console.log('Bucket :'+bucket)
    if(fileName.startsWith('thumb_')){
        console.log('Alerady a Thumbnail')
        return
    }
    if  (!object.contentType.startsWith('image/')){
        console.log('This is not an image:'+object.contentType)
        return
    }
    if  (object.resourceState === 'not_exists'){
        console.log('This is a deletion event')
        return
    }
    return bucket.file(filePath).download({
        destination: tempFilePath
    })
    .then(()=>{
        console.log('Image Download locally to',tempFilePath)
        return spawn('convert',[tempFilePath,'-thumbnail','200x200',
        tempFilePath])
    })
    .then(()=>{
        console.log('Thumbnail created')
        return bucket.upload(tempFilePath,{
            destination: thumbFilePath
        })
    }).then(()=>{
        const thumbFile = bucket.file(thumbFilePath)
        const config = {
            action: 'read',
            expires: '03-09-2491'
        }
        return Promise.all([
            thumbFile.getSignedUrl(config),
            file.getSignedUrl(config)
        ])
    }).then(results => {
        const thumbResult = results[0]
        const originalResult = results [1]
        const thumbFileUrl = thumbResult[0]
        const fileUrl  = originalResult[0]
        console.log('Downloadable link:'+fileUrl)
        sendNotification(fileUrl);
        return;
    })
    return bucket.upload(tempFilePath,{
        destination: thumbFilePath
    })
})
exports.sanitizePost = functions.database
.ref('/posts/{pushId}')
.onWrite(event => {
    const post = event.data.val()
    if (post.sanitized) {
            return
    }
    console.log("Sanitizing new post "+ event.params.pushId)
    console.log(post)
    
    post.body = "Notification Sent to Mobile"
    sendNotification(post.body)
     return event.data.ref.set(post)
})
function sendNotification(msg){
    var message = {
        to: '/topics/news', // required fill with device token or topics
        data: {
            serveMessage: msg
        },
        notification: {
            title: 'Firebase',
            body: 'Database Change Alert'
        }
    };

    fcm.send(message, function(err, response){
        if (err) {
            console.log("Error in Sending notification :"+err);
        } else {
            console.log("Successfully sent with response: ", response);
        }
    });
}

