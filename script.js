// Wait for Firebase
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(() => {
    if (typeof firebase !== 'undefined') {
      console.log("Firebase loaded successfully");
    } else {
      console.error("Firebase failed to load");
    }
  }, 100);
});

function getFirebaseInstances() {
  return {
    auth: window.auth || firebase.auth(),
    db: window.db || firebase.firestore()
  };
}

// Register new user
function registerUser() {
  const { auth, db } = getFirebaseInstances();
  const name = document.getElementById("regName").value.trim();
  const email = document.getElementById("regEmail").value.trim();
  const password = document.getElementById("regPass").value;

  if (!name || !email || !password) {
    alert("Please fill in all fields.");
    return false;
  }
  if (password.length < 6) {
    alert("Password must be at least 6 characters long.");
    return false;
  }

  const submitBtn = document.querySelector('#registerForm button[type="submit"]');
  const originalText = submitBtn.textContent;
  submitBtn.textContent = "Registering...";
  submitBtn.disabled = true;

  auth.createUserWithEmailAndPassword(email, password)
    .then(userCredential => {
      return userCredential.user.updateProfile({ displayName: name });
    })
    .then(() => {
      return db.collection("users").doc(auth.currentUser.uid).set({
        displayName: name,
        email: email,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        isAdmin: false
      });
    })
    .then(() => {
      alert("Registration successful! Please log in.");
      window.location.href = "index.html";
    })
    .catch(error => {
      alert("Registration failed: " + error.message);
    })
    .finally(() => {
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    });

  return false;
}

// Login user, redirect based on admin status
function loginUser() {
  const { auth, db } = getFirebaseInstances();
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPass").value;

  if (!email || !password) {
    alert("Please enter email and password.");
    return false;
  }

  const submitBtn = document.querySelector('#loginForm button[type="submit"]');
  const originalText = submitBtn.textContent;
  submitBtn.textContent = "Logging in...";
  submitBtn.disabled = true;

  auth.signInWithEmailAndPassword(email, password)
    .then(userCredential => {
      const user = userCredential.user;
      return db.collection("users").doc(user.uid).get();
    })
    .then(doc => {
      if (!doc.exists) throw new Error("User data not found.");
      const userData = doc.data();

      if (userData.isAdmin) {
        alert("Admin login successful!");
        window.location.href = "admin.html";
      } else {
        alert("Login successful!");
        window.location.href = "dashboard.html";
      }
    })
    .catch(error => {
      alert("Login failed: " + error.message);
    })
    .finally(() => {
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    });

  return false;
}

// Logout user
function logout() {
  const { auth } = getFirebaseInstances();
  auth.signOut()
    .then(() => {
      alert("Logged out successfully!");
      window.location.href = "index.html";
    })
    .catch(error => {
      alert("Error logging out: " + error.message);
    });
}

// NEW: Load dashboard for regular users - displays approved reviews
function loadDashboard() {
  const { auth, db } = getFirebaseInstances();
  const userBooksDiv = document.getElementById("userBooks");
  if (!userBooksDiv) return;

  userBooksDiv.innerHTML = "<p>Loading reviews...</p>";

  auth.onAuthStateChanged(user => {
    if (!user) {
      window.location.href = "index.html";
      return;
    }

    // Load only approved reviews for regular users
    // First try to get all reviews, then filter approved ones
    db.collection("reviews")
      .get()
      .then(snapshot => {
        userBooksDiv.innerHTML = "";
        
        // Filter approved reviews and sort by timestamp
        const approvedReviews = [];
        snapshot.forEach(doc => {
          const book = doc.data();
          if (book.approved === true) {
            approvedReviews.push(book);
          }
        });

        // Sort by timestamp (most recent first)
        approvedReviews.sort((a, b) => {
          if (a.timestamp && b.timestamp) {
            return b.timestamp.toMillis() - a.timestamp.toMillis();
          }
          return 0;
        });

        if (approvedReviews.length === 0) {
          userBooksDiv.innerHTML = "<p>No approved reviews found yet.</p>";
          return;
        }

        approvedReviews.forEach(book => {
          const bookCard = document.createElement("div");
          bookCard.classList.add("book-card");
          bookCard.innerHTML = `
            <h3>${escapeHtml(book.title)}</h3>
            <p><strong>Author:</strong> ${escapeHtml(book.author)}</p>
            <p><strong>Price:</strong> ${escapeHtml(book.price)}</p>
            <p><strong>Review:</strong> ${escapeHtml(book.review)}</p>
            <p><strong>Reviewed by:</strong> ${escapeHtml(book.userName)}</p>
            <a href="${book.link}" target="_blank" class="buy-link">Buy Here</a>
          `;
          userBooksDiv.appendChild(bookCard);
        });
      })
      .catch(error => {
        console.error("Error loading reviews:", error);
        userBooksDiv.innerHTML = "<p>Error loading reviews. Please try again.</p>";
      });
  });
}

// Submit book review
function submitBook() {
  const { auth, db } = getFirebaseInstances();
  const title = document.getElementById("bookTitle").value.trim();
  const author = document.getElementById("bookAuthor").value.trim();
  const price = document.getElementById("bookPrice").value.trim();
  const link = document.getElementById("bookLink").value.trim();
  const review = document.getElementById("bookReview").value.trim();

  if (!title || !author || !price || !link || !review) {
    alert("Please fill in all fields.");
    return;
  }

  const user = auth.currentUser;
  if (!user) {
    alert("You must be logged in to submit a review.");
    return;
  }

  const submitBtn = document.querySelector('#reviewForm button[type="submit"]');
  const originalText = submitBtn.textContent;
  submitBtn.textContent = "Submitting...";
  submitBtn.disabled = true;

  db.collection("reviews").add({
    title: title,
    author: author,
    price: price,
    link: link,
    review: review,
    userName: user.displayName || "Anonymous",
    userEmail: user.email,
    userId: user.uid,
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    approved: false
  })
  .then(() => {
    alert("Review submitted successfully! It will be visible once approved by an admin.");
    document.getElementById("reviewForm").reset();
  })
  .catch(error => {
    alert("Error submitting review: " + error.message);
  })
  .finally(() => {
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
  });
}

// Search reviews function
function searchReviews() {
  const searchTerm = document.getElementById("searchBar").value.toLowerCase();
  const bookCards = document.querySelectorAll(".book-card");
  
  bookCards.forEach(card => {
    const text = card.textContent.toLowerCase();
    if (text.includes(searchTerm)) {
      card.style.display = "block";
    } else {
      card.style.display = "none";
    }
  });
}

// Load admin panel: check admin, show reviews & admins
function loadAdmin() {
  const { auth, db } = getFirebaseInstances();
  const adminBooksDiv = document.getElementById("adminBooks");
  if (!adminBooksDiv) return;

  adminBooksDiv.innerHTML = "<p>Loading reviews...</p>";

  auth.onAuthStateChanged(user => {
    if (!user) {
      window.location.href = "index.html";
      return;
    }

    db.collection("users").doc(user.uid).get().then(doc => {
      if (!doc.exists || !doc.data().isAdmin) {
        alert("Access denied. Admins only.");
        window.location.href = "index.html";
        return;
      }

      // Load reviews with better organization
      db.collection("reviews").orderBy("timestamp", "desc").get()
        .then(snapshot => {
          adminBooksDiv.innerHTML = "";
          if (snapshot.empty) {
            adminBooksDiv.innerHTML = "<p>No reviews found.</p>";
            return;
          }

          // Create sections for pending and approved reviews
          const pendingSection = document.createElement("div");
          pendingSection.classList.add("admin-section");
          pendingSection.innerHTML = "<h3 class='section-title'>📝 Pending Reviews</h3>";
          
          const approvedSection = document.createElement("div");
          approvedSection.classList.add("admin-section");
          approvedSection.innerHTML = "<h3 class='section-title'>✅ Approved Reviews</h3>";

          let pendingCount = 0;
          let approvedCount = 0;

          snapshot.forEach(doc => {
            const book = doc.data();
            const id = doc.id;
            const bookCard = document.createElement("div");
            bookCard.classList.add("book-card", "admin-card");
            
            // Format timestamp
            const timestamp = book.timestamp ? book.timestamp.toDate().toLocaleDateString() : "Unknown";
            
            bookCard.innerHTML = `
              <div class="admin-card-header">
                <h3>${escapeHtml(book.title)}</h3>
                <span class="review-date">${timestamp}</span>
              </div>
              <div class="admin-card-content">
                <div class="book-info">
                  <p><strong>Author:</strong> ${escapeHtml(book.author)}</p>
                  <p><strong>Price:</strong> ${escapeHtml(book.price)}</p>
                  <p><strong>Submitted by:</strong> ${escapeHtml(book.userName)} (${escapeHtml(book.userEmail)})</p>
                </div>
                <div class="review-content">
                  <p><strong>Review:</strong></p>
                  <div class="review-text">${escapeHtml(book.review)}</div>
                </div>
                <div class="book-actions">
                  <a href="${book.link}" target="_blank" class="buy-link">🔗 Buy Link</a>
                  <div class="admin-actions">
                    <div class="approval-status">
                      ${book.approved ? '<span class="approved-badge">✅ Approved</span>' : '<span class="pending-badge">⏳ Pending</span>'}
                    </div>
                    <div class="admin-buttons">
                      ${!book.approved ? `<button onclick="approveBook('${id}')" class="approve-btn">✅ Approve</button>` : ''}
                      <button onclick="deleteBook('${id}')" class="delete-btn">🗑️ Delete</button>
                    </div>
                  </div>
                </div>
              </div>
            `;

            if (book.approved) {
              approvedSection.appendChild(bookCard);
              approvedCount++;
            } else {
              pendingSection.appendChild(bookCard);
              pendingCount++;
            }
          });

          // Update section titles with counts
          pendingSection.querySelector('.section-title').textContent = `📝 Pending Reviews (${pendingCount})`;
          approvedSection.querySelector('.section-title').textContent = `✅ Approved Reviews (${approvedCount})`;

          // Add sections to admin books div
          adminBooksDiv.appendChild(pendingSection);
          adminBooksDiv.appendChild(approvedSection);

          // Add empty messages if no reviews in sections
          if (pendingCount === 0) {
            const emptyMsg = document.createElement("p");
            emptyMsg.classList.add("empty-message");
            emptyMsg.textContent = "No pending reviews.";
            pendingSection.appendChild(emptyMsg);
          }
          if (approvedCount === 0) {
            const emptyMsg = document.createElement("p");
            emptyMsg.classList.add("empty-message");
            emptyMsg.textContent = "No approved reviews.";
            approvedSection.appendChild(emptyMsg);
          }
        })
        .catch(error => {
          console.error("Error loading reviews:", error);
          adminBooksDiv.innerHTML = "<p>Error loading reviews.</p>";
        });

      // Load admins list
      loadAdmins();
    });
  });
}

// Load admins list for admin management
function loadAdmins() {
  const { db } = getFirebaseInstances();
  const adminList = document.getElementById("adminList");
  if (!adminList) return;

  adminList.innerHTML = "<li>Loading admins...</li>";

  db.collection("users").where("isAdmin", "==", true).get()
    .then(snapshot => {
      if (snapshot.empty) {
        adminList.innerHTML = "<li>No admins found.</li>";
        return;
      }

      adminList.innerHTML = "";
      snapshot.forEach(doc => {
        const user = doc.data();
        const li = document.createElement("li");
        li.textContent = `${user.displayName || "No Name"} (${user.email})`;
        adminList.appendChild(li);
      });
    })
    .catch(error => {
      console.error("Error loading admins:", error);
      adminList.innerHTML = "<li>Error loading admins.</li>";
    });
}

// Promote user to admin by email
document.getElementById("promoteForm")?.addEventListener("submit", function(e) {
  e.preventDefault();
  const emailToPromote = document.getElementById("promoteEmail").value.trim().toLowerCase();
  if (!emailToPromote) {
    alert("Please enter an email.");
    return;
  }

  const { db } = getFirebaseInstances();

  db.collection("users").where("email", "==", emailToPromote).get()
    .then(snapshot => {
      if (snapshot.empty) {
        alert("No user found with that email.");
        return;
      }

      const userDoc = snapshot.docs[0];
      userDoc.ref.update({ isAdmin: true })
        .then(() => {
          alert(`User ${emailToPromote} has been promoted to admin.`);
          document.getElementById("promoteForm").reset();
          loadAdmins();
        })
        .catch(err => {
          alert("Error promoting user: " + err.message);
        });
    })
    .catch(error => {
      alert("Error finding user: " + error.message);
    });
});

// Approve a review
function approveBook(id) {
  const { db } = getFirebaseInstances();
  if (!confirm("Approve this review?")) return;

  db.collection("reviews").doc(id).update({
    approved: true,
    approvedAt: firebase.firestore.FieldValue.serverTimestamp()
  })
  .then(() => {
    alert("Review approved successfully!");
    loadAdmin();
  })
  .catch(error => {
    alert("Error approving review: " + error.message);
  });
}

// Delete a review
function deleteBook(id) {
  const { db } = getFirebaseInstances();
  if (!confirm("Delete this review? This action cannot be undone.")) return;

  db.collection("reviews").doc(id).delete()
    .then(() => {
      alert("Review deleted successfully!");
      loadAdmin();
    })
    .catch(error => {
      alert("Error deleting review: " + error.message);
    });
}

// Utility escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}