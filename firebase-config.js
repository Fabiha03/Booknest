// firebase-config.js

const firebaseConfig = {
  apiKey: "AIzaSyAQl0NRrzTU1SujAXkzKEaK9VKDRGG1H6o",
  authDomain: "booknest-84545.firebaseapp.com",
  projectId: "booknest-84545",
  storageBucket: "booknest-84545.appspot.com",
  messagingSenderId: "354702042951",
  appId: "1:354702042951:web:3da44057904aea1ac94e62"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Make auth and db available globally
window.auth = firebase.auth();
window.db = firebase.firestore();

console.log("Firebase initialized successfully");

// Add auth state change listener for debugging
firebase.auth().onAuthStateChanged(user => {
  if (user) {
    console.log("User is signed in:", user.email);
  } else {
    console.log("User is signed out");
  }
});