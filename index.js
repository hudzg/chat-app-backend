import { JWT } from "google-auth-library";
// const fetch = require("node-fetch");
import key from "./service-account.json" assert { type: "json" };
import admin from "firebase-admin";

const SCOPES = ["https://www.googleapis.com/auth/firebase.messaging"];
const PROJECT_ID = key.project_id;
const FCM_URL = `https://fcm.googleapis.com/v1/projects/${PROJECT_ID}/messages:send`;

admin.initializeApp({
  credential: admin.credential.cert(key),
  databaseURL: `https://chat-app-ec5a7-default-rtdb.asia-southeast1.firebasedatabase.app/`,
});

const rtdb = admin.database();
const db = admin.firestore();
const ref = rtdb.ref("calls");

// Hàm lấy access token từ service account
function getAccessToken() {
  return new Promise((resolve, reject) => {
    const jwtClient = new JWT(
      key.client_email,
      null,
      key.private_key,
      SCOPES,
      null
    );
    jwtClient.authorize((err, tokens) => {
      if (err) {
        reject(err);
      } else {
        resolve(tokens.access_token);
      }
    });
  });
}

// Hàm gửi FCM
async function sendNotification(deviceToken, title, body) {
  try {
    const accessToken = await getAccessToken();
    const message = {
      message: {
        token: deviceToken,
        notification: {
          title: title,
          body: body,
        },
      },
    };

    const response = await fetch(FCM_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    const data = await response.json();
    console.log("✅ FCM response:", data);
  } catch (error) {
    console.error("❌ Error sending FCM:", error);
  }
}

// 🧪 Gọi thử (thay thế token thật vào đây)
// const deviceToken =
//   "fLLOnvIISdiir74QhIy7oi:APA91bElZbJjnNBdlAwHZWbtyHEqIWbFIOX8rAKUgc_MQdHIMVN6gEnCo2DMqeDQO1_jnE2CU3qoGKE00ag86_2_XDCn5HBtc_I8aww_noJO5KBBkj35nyI";
// sendNotification(deviceToken, "📞 Cuộc gọi đến", "Ai đó đang gọi bạn...");

ref.on("child_added", async (snapshot) => {
  console.log(snapshot.val());
  try {
    const callData = snapshot.val();

    // Get recipient's data from Firestore
    const recipientDoc = await db.collection("users").doc(callData.to).get();

    if (!recipientDoc.exists) {
      console.log(`No user found with ID: ${callData.to}`);
      return;
    }

    console.log("Recipient doc:", recipientDoc.data());
    const recipientTokens = recipientDoc.data()?.fcmTokens || [];
    if (recipientTokens.length === 0) {
      console.log("No FCM tokens found for recipient");
      return;
    }
    // Send to all recipient's devices
    const notificationPromises = recipientTokens.map((token) => {
      console.log("Sending notification to token:", token);
      return sendNotification(token, "Incoming Call", `hung`);
    });

    await Promise.all(notificationPromises);
    console.log("Notifications sent successfully");
  } catch (error) {
    console.error("Error sending call notification:", error);
  }
});
