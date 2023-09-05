const express = require("express");
const admin = require("firebase-admin");
const serviceAccount = require("/etc/secrets/keys.json");
var cors = require("cors");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL:
    "https://leavemanagementlinkzy-default-rtdb.asia-southeast1.firebasedatabase.app",
});

// Create an Express application
const app = express();
const port = process.env.PORT || 3000;
const checkAdmin = require("./adminAuth");
app.use(express.json());

app.use(
  cors({
    origin: "*",
  })
);

// Define a route
app.get("/", (req, res) => {
  res.send("Hello, Firebase and Express!");
});

app.get("/user/:uid", checkAdmin, (req, res) => {
  const uid = req.params.uid;
  console.log("came");
  admin
    .auth()
    .getUser(uid)
    .then((userRecord) => {
      console.log(
        `Successfully fetched user data: ${JSON.stringify(userRecord.toJSON())}`
      );
      res.status(200).json(userRecord.toJSON());
    })
    .catch((error) => {
      console.log("Error fetching user data:", error);
      res.status(500).json({ error: "Error fetching user data" });
    });
});

app.delete("/user/:uid", checkAdmin, (req, res) => {
  const uid = req.params.uid;
  admin
    .auth()
    .deleteUser(uid)
    .then(() => {
      console.log("Successfully deleted user");
      res.status(200).json({ message: "Successfully deleted user" });
    })
    .catch((error) => {
      console.log("Error deleting user:", error);
      res.status(400).json({ message: "Error deleting user" });
    });
});

app.delete("/userdel/:email", checkAdmin, (req, res) => {
  const email = req.params.email;
  deleteUserByEmail(email)
    .then(() => {
      console.log("Successfully deleted user");
      res.status(200).json({ message: "Successfully deleted user from RTDB" });
    })
    .catch((error) => {
      console.log("Error deleting user:", error);
      res.status(400).json({ message: "Error deleting user" });
    });
});

async function deleteUserByEmail(email) {
  try {
    const database = admin.database();
    const ref = database.ref("users");
    const snapshot = await ref
      .orderByChild("email")
      .equalTo(email)
      .once("value");
    if (!snapshot.exists()) {
      console.log(`No user found with email: ${email}`);
      return;
    }
    const key = Object.keys(snapshot.val())[0];
    await ref.child(key).remove();
    console.log("Successfully deleted user");
  } catch (error) {
    console.error("Error deleting user:", error);
    throw error;
  }
}

app.get("/users", checkAdmin, async (req, res) => {
  try {
    const userData = await listAllUsers();
    res.json(userData);
  } catch (error) {
    console.error("Error retrieving user data:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

const listAllUsers = async () => {
  const authUsers = await admin.auth().listUsers(1000); // List 1000 users at a time

  const usersWithDetails = await Promise.all(
    authUsers.users.map(async (userRecord) => {
      const email = userRecord.email;
      const userDetails = await fetchUserDetailsFromDatabase(email);
      return { ...userRecord.toJSON(), userDetails };
    })
  );

  return usersWithDetails;
};

const fetchUserDetailsFromDatabase = (email) => {
  return new Promise((resolve, reject) => {
    admin
      .database()
      .ref("users")
      .orderByChild("email")
      .equalTo(email)
      .once("value")
      .then((snapshot) => {
        const userDetail = snapshot.val();
        resolve(userDetail);
      })
      .catch((error) => {
        reject(error);
      });
  });
};
app.post("/updateUser/:uid", checkAdmin, async (req, res) => {
  const uid = req.params.uid;
  const updateObject = req.body;
  try {
    await updateUser(uid, updateObject);
    res.status(200).json({ message: "User updated successfully" });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

const updateUser = (uid, update1) => {
  const update = update1.update;
  console.log(uid, update);
  const newUpdateObj = {
    designation: update.designation,
    email: update.email,
    name: update.name,
    role: update.role,
  };
  if (update.password == "") {
    innerObj = {
      email: update.email,
      displayName: update.name,
    };
  } else {
    innerObj = {
      email: update.email,
      password: update.password,
      displayName: update.name,
    };
  }
  return new Promise(async (resolve, reject) => {
    try {
      await admin.auth().setCustomUserClaims(uid, { role: update.role });
      const userRecord = await admin.auth().updateUser(uid, innerObj);
      console.log("Successfully updated user", userRecord.toJSON());
      const dbRef = admin.database().ref("users");
      const snapshot = await dbRef
        .orderByChild("email")
        .equalTo(update.oldEmail)
        .once("value");
      if (snapshot.exists()) {
        const key = Object.keys(snapshot.val())[0];
        await dbRef.child(key).set(newUpdateObj);
        console.log({ message: "Data replaced successfully" });
        resolve();
      } else {
        console.log({ message: "Data not found" });
        reject("Data not found");
      }
    } catch (error) {
      console.log("Error updating user:", error);
      reject(error);
    }
  });
};



// Start the Express server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
