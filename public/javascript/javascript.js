// Initialize Firebase
import { firebaseConfig } from './config.js';
firebase.initializeApp(firebaseConfig);

var storage = firebase.storage();

let wavesLoaded = [];

let audioURL = "";
let blob;
let AUDIO_PATH = "/Noize/waves-audio/";
let selfUser;
var nowPlaying = "";
var audio = new Audio();
let activeUser;
let lastPlayed = 0;
let playThrough = false;
let livePage = "recent";
let pageProfile = "all";

let wavesToLoad;
let recordingTime = 0;

let pageSwap = true;
let col;

var gumStream;
var rec;
var input;
var AudioContext = window.AudioContext || window.webkitAudioContext;
var audioContext;

function page(path = "") {
  if (path.includes("@")) {
    let user = path.split("@")[1];
    livePage = "profile";
    pageProfile = user;
    updateFeed(true, 7);
    updateNav("");
  }
  switch (path) {
    case '/html/signup.html':
      signup();
      break;
    case '/html/app.html':
      home();
      break;
    case '/html/demo.html':
      home(true);
      break;
    case '/amped':
      document.getElementById("current-page-title").innerHTML = "amped";
      livePage = "profile";
      pageProfile = "#amped";
      updateFeed(true, 7);
      updateNav("");
      break;
    case '/loud':
      document.getElementById("current-page-title").innerHTML = "#loud";
      livePage = "recent";
      pageProfile = "#loud";
      updateFeed(true, 7);
      updateNav("");
      break;
    case '/html/app':
      livePage = "recent";
      pageProfile = "all";
      updateFeed(true, 7);
      updateNav("");
      break;
    default:
      signin();
  }
}
page(window.location.pathname);

function signup() {

  // Get the form element
  var signupForm = document.getElementById("signup-form");

  // Add an event listener for the submit event
  signupForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    let check = true;

    // Get the email and password values from the form
    var email = signupForm.elements.email.value;
    var password = signupForm.elements.password.value;
    var username = signupForm.elements.username.value;
    let regex = /^[a-zA-Z0-9_]+$/;

    if (!regex.test(username)) {
      alert('Username is my only contain letters, numbers, and underscores ("_")');
      return;
    }

    if (!isValidEmail(email)) {
      alert('Invalid email');
      return;
    }

    let query = firebase.firestore().collection("users").where("username", "==", username);
    await query.get()
      .then(function (querySnapshot) {
        if (!querySnapshot.empty) {
          alert("Username:" + username + " already taken");
          check = false;
          return false;
        }
      })
      .catch(function (error) {
        console.log("Error getting documents: ", error);
        return false;
      });
    if (!check) {
      return;
    }

    // Sign up the user with Firebase
    firebase.auth().createUserWithEmailAndPassword(email, password)
      .then(function (user) {
        // The user has been successfully created
        alert("Sign-up successful!");
        firebase.firestore().collection('users').add({
          amped: [],
          damped: [],
          created: [],
          following: [],
          username: username,
          userID: user.user.uid,
          email: user.user.email
        }).then(function (docRef) {
          activeUser = {
            amped: [],
            damped: [],
            created: [],
            username: username,
            userID: user.user.uid,
            docID: docRef.id,
            email: user.user.email
          };
          window.location.href = "/html/app.html";
        }).catch(function (error) {
        });
      }).catch(function (error) {
        // An error occurred while creating the user
        console.error(error);
        alert("Error: " + error.message);
      });
  });
}

function signin() {
  var signinForm = document.getElementById("signin-form");
  // Add an event listener for the sign-in form's submit event
  signinForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    // Get the email and password values from the form
    var email = signinForm.elements.email.value;
    var password = signinForm.elements.password.value;

    if (!isValidEmail(email)) {
      let query = firebase.firestore().collection("users").where("username", "==", email);
      await query.get()
        .then(function (querySnapshot) {
          if (!querySnapshot.empty) {
            querySnapshot.forEach(function (doc) {
              email = doc.data().email;
            });
          }
        })
        .catch(function (error) {
          console.log("Error getting documents: ", error);
          return false;
        });

    }

    // Sign in the user with Firebase
    firebase.auth().signInWithEmailAndPassword(email, password)
      .then(function (user) {
        // The user has been successfully signed in
        activeUser = getActiveUser(user);
        //updateActiveUser(activeUser);
        window.location.href = "/html/app.html";
      })
      .catch(function (error) {
        // An error occurred while signing in the user
        console.error(error);
        alert("Error: " + error.message);
      });
  });
}

var recognition;
function transcribeAudio() {
  var wave = document.getElementById('wave');
  // Create a new instance of the webkitSpeechRecognition API
  recognition = new webkitSpeechRecognition();
  recognition.continuous = true;

  // Set the language of the speech to be recognized
  recognition.lang = 'en-US';

  // Set the maximum number of alternatives to return
  recognition.maxAlternatives = 1;
  recognition.start();

  // Set the event to listen to when speech is recognized
  recognition.onresult = function (event) {
    var transcript = event.results[event.results.length - 1][0].transcript;
    wave.elements.message.value += transcript;
    updateCharCount();
  };

  // Set the event to listen to when the recognition process ends
  recognition.onend = function (event) {
  };
}

function home(demo = false) {
  const usernameNavItem = document.getElementById('username-nav-item');
  const toggleNavbar = document.getElementById("current-page-title");
  audio = document.getElementById('play-button-audio');
  audio.disableRemotePlayback = true;
  col = "waves";
  if (demo) {
    col = "demoWaves";
    AUDIO_PATH = "/Noize/waves-audio/demo/";
  }

  var timeout;
  var isRunning = false;
  window.onscroll = function () {
    clearTimeout(timeout);
    if (isRunning) {
      return;
    }
    timeout = setTimeout(async function () {
      isRunning = true;
      if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight + 15) {
        await updateFeed(false, 7);
      }
      isRunning = false;
    }, 111);
  };

  firebase.auth().onAuthStateChanged(async function (user) {
    if (user || demo) {
      if (typeof (activeUser) === "undefined" && !demo) {
        const waitForActiveUser = new Promise((resolve) => {
          getActiveUser(user, firebase.auth().currentUser.uid)
            .then(response => {
              activeUser = response;
              resolve();
            });
        });
        waitForActiveUser.then(() => {
          console.log("activeUser:", activeUser);
          usernameNavItem.innerText = "@" + activeUser.username;
        });
        // User is signed in
        selfUser = { user: firebase.auth().currentUser.uid };

      } else if (demo) {
        activeUser = { username: "Demo", userID: "00000001" };
        selfUser = { user: "00000001" };
      }


      await updateFeed(true, 7);
      // Get the form element
      var wave = document.getElementById('wave');
      const startButton = document.getElementById('start-button');
      startButton.classList.add('center');
      const playButton = document.getElementById('play-button');
      let fileInput = document.querySelector('#file');
      fileInput.onchange = function () {
        audioURL = "";
        let file = fileInput.files[0];
        audio = document.querySelector('audio');
        audio.src = URL.createObjectURL(file);
        audio.onloadedmetadata = function () {
          file = fileInput.files[0];
          if (audio.duration > 90) {
            alert("Audio clip must be 1:30 or less");
            fileInput.value = null;
          } else {
            audio.play();
            wave.elements.message.value = file.name;
            updateCharCount();
          }
        }
      };

      let rerecorded;
      // Add an event listener for the form's submit event
      wave.addEventListener('submit', async function (event) {
        event.preventDefault();
        if (rec && rec.recording) {
          return;
        }
        if (demo) {
          alert("Demo account cannot post waves. Please sign up for a free account to share your Noize.");
          return;
        }
        const check = await spamCheck();
        if (!check) {
          alert("Whoa, Slow your roll! You're making a lot of Noize. Please wait one hour before posting again.");
          return;
        }

        let filter = chatFilter(wave.elements.message.value);
        if (filter[0] === false || rerecorded === false) {
          switch (filter[1]) {
            case "badWord":
              alert("Your message contains a banned word or phrase. Please rerecord/upload and try again.");
              rerecorded = false;
              break;
            case "badLink":
              alert("Noize only support sharing links to photos. Please update the message and try again.");
              break;
            case "tooLong":
              alert("Noize only support messages up to 300 characters. Please update the message and try again.");
              break;
            default:
              alert("Unable to share your wave. Please rerecord/upload and try again.");
              pass;
          }
          return;
        }

        var timestamp = new firebase.firestore.Timestamp.now();

        // Get the message value from the form
        var waveText = wave.elements.message.value;
        if (waveText === "" || waveText.trim() === "") {
          alert("Please Enter a Message");
        }
        if (waveText !== "" && waveText.trim() !== "" &&
          (audioURL !== "" || fileInput.value !== "")) {
          let fileName = firebase.auth().currentUser.uid + generateRandomString();
          if (audioURL) {
            saveAudioToGCS(blob, fileName);
          } else if (fileInput.value) {
            uploadAudio(fileInput, fileName);
          }
          startButton.innerText = "Make Some Noize!";

          // Add the message to the Cloud Firestore database
          let retWave = {
            message: waveText,
            user: firebase.auth().currentUser.uid,
            username: activeUser.username,
            timeStamp: timestamp,
            audio: AUDIO_PATH + fileName,
            score: 1,
            amped: [selfUser],
            damped: [],
          };
          firebase.firestore().collection(col).add(retWave).then(function (docRef) {
            const res = docRef.set({
              waveID: docRef.id
            }, { merge: true });
            appendToAmped(activeUser, docRef.id);
            appendToCreated(activeUser, docRef.id);

            wavesLoaded.push(retWave);

            // The message was successfully added to the database
            let audio_ = document.querySelector('audio');
            audio_.src = "";

            wave.elements.message.value = "";
            wave.elements.file.value = "";

            return docRef.get();
          }).then((doc) => {
            document.getElementById("wave").classList.remove("show");
            updateFeed(true, 7);
          }).catch(function (error) {
            // An error occurred while adding the message to the database
            console.error(error);
          });

        }
      });

      let timeoutId;
      let clickCount = 0;
      let playClickCount = 0;

      function stopRecording() {
        startButton.style.animation = "none";
        startButton.style.scale = "1";
        startButton.style.backgroundColor = "#333";
        startButton.innerText = "Re-record";

        clickCount = 0;

        clearTimeout(timeoutId);
        recognition.stop();

        rec.stop();
        gumStream.getAudioTracks()[0].stop();
        rec.exportWAV(createDownloadLink);
      }

      startButton.addEventListener('click', (event) => {
        clickCount++;
        if (clickCount === 1) {
          if (event["pointerId"] !== -1) {
            rerecorded = true;
          }
          transcribeAudio();
          if (startButton.innerText === "Re-record" || wave.elements.file.value !== "") {
            wave.elements.message.value = "";
            wave.elements.file.value = ""
          }
          console.log("recordButton clicked");
          navigator.mediaDevices.getUserMedia({ audio: true })
            .then((audioStream) => {
              console.log("getUserMedia() success, stream created, initializing Recorder.js ...");
              startButton.style.animation = "pulse 2s infinite";
              startButton.innerText = "Recording...";

              audioContext = new AudioContext();
              gumStream = audioStream;
              input = audioContext.createMediaStreamSource(audioStream);
              rec = new Recorder(input, { numChannels: 1 });
              rec.record();
              console.log("Recording started");

              document.getElementById("wave").classList.add("show");
              recordingTime = 0;
              updateCharCount();
              const intervalId = setInterval(() => {
                if (!rec.recording) {
                  clearInterval(intervalId);
                  return;
                }
                recordingTime++;
                updateCharCount();
              }, 1000);

              // stop recording after 30 seconds
              timeoutId = setTimeout(stopRecording, 30000);

            }).catch(error => console.error(`Error: ${error}`));
        } else {
          stopRecording();
        }

      });

      // Add event listeners
      startButton.addEventListener("dragenter", handleDragEnter, false);
      startButton.addEventListener("dragleave", handleDragLeave, false);
      startButton.addEventListener("dragover", handleDragOver, false);
      startButton.addEventListener("drop", handleDrop, false);
      let currentStartButtonText = "";
      function handleDragEnter(e) {
        // Add a class to the drop area to change its styling when a file is dragged over it
        this.classList.add("drag-over");
        currentStartButtonText = startButton.innerText;
        startButton.innerText = "Drop to upload 🔈";
      }

      function handleDragLeave(e) {
        // Remove the class when the file is no longer being dragged over the drop area
        this.classList.remove("drag-over");
        startButton.innerText = currentStartButtonText;
      }

      function handleDragOver(e) {
        // Prevent the default behavior when a file is dragged over the drop area (to prevent file from being opened)
        e.preventDefault();
      }

      function handleDrop(e) {
        if (wave.classList.contains("show") === false) {
          startButton.innerText = "Re-record / Re-upload";
          wave.classList.add("show");
        }
        // Get the files that were dropped
        let files = e.dataTransfer.files;

        // Update the file input with the dropped files
        fileInput.files = files;
        fileInput.onchange();

        // Prevent the default behavior when a file is dropped on the drop area (to prevent file from being opened)
        e.preventDefault();
      }

      // Set a variable to track the start time of the button press
      var intervalId
      let title = document.getElementById("title");

      // Add a touchstart event listener to the button
      title.addEventListener("touchstart", function () {
        intervalId = setTimeout(function () {
          // Trigger action here
          playButton.classList.toggle("hide");
          document.getElementById("play-button-audio").classList.toggle("hide");

          clearInterval(intervalId);
        }, 1500);
      });

      // Add a touchend event listener to the button
      title.addEventListener("touchend", function () {
        // Clear the interval
        clearInterval(intervalId);
      });

      title.addEventListener("mousedown", function () {
        intervalId = setTimeout(function () {
          // Trigger action here
          playButton.classList.toggle("hide");
          document.getElementById("play-button-audio").classList.toggle("hide");
          pageSwap = false;
          clearInterval(intervalId);
        }, 1500);
      });

      title.addEventListener("mouseup", function () {
        clearTimeout(intervalId);
      });

      var promiseResolve, promiseReject;
      let playByttonIntervalId;
      playButton.addEventListener('click', async (event) => {

        playClickCount++;
        console.log(playClickCount);
        if (playClickCount === 1) {
          playButton.innerText = "Pause";

          let cards = document.querySelectorAll('.card');
          playThrough = true;
          var oldLength = cards.length;
          for (let i = lastPlayed; i < cards.length; i++) {
            if (playThrough === false) {
              playButton.innerText = "Play";
              break;
            }
            await cards[i].querySelector(".textCell").click();
            cards[i].classList.add("active");
            await new Promise(function (resolve, reject) {
              promiseResolve = resolve;
              promiseReject = reject;
              audio.onended = () => {
                clearInterval(playByttonIntervalId);
                promiseResolve();
              };
            });

            if (lastPlayed === document.querySelectorAll(".card").length - 1) {
              if (document.querySelectorAll('.card').length > oldLength || updateFeed(false, 5)) {
                setTimeout(function () {
                  if (audio.ended) {
                    playButton.textContent = "Loading...";
                  }
                }, 1000);
                await new Promise(function (resolve, reject) {
                  promiseResolve = resolve;
                  promiseReject = reject;
                  playByttonIntervalId = setInterval(() => {
                    if (document.querySelectorAll('.card').length > oldLength) {
                      clearInterval(playByttonIntervalId);
                      promiseResolve();
                    }
                  }, 500);
                });
                cards = document.querySelectorAll('.card');
                continue;
              }

              lastPlayed = 0;
              playClickCount = 0;
              playButton.innerHTML = "Play";
              audio.pause();
              audio.currentTime = 0;
              break;
            } else if (document.querySelectorAll('.card').length > oldLength) {
              cards = document.querySelectorAll('.card');
              oldLength = cards.length;
              continue;

            }
          }
        } else {

          clearInterval(playByttonIntervalId);
          playClickCount = 0;
          playThrough = false;
          playButton.innerHTML = "Play";
          audio.currentTime = 0;
          let activecard = document.querySelector(".card.active");

          if (activecard !== null) {
            activecard.querySelector(".textCell").click();
          } else {
            audio.pause();
          }
        }
      });
      toggleNavbar.addEventListener('click', () => {
        if (typeof (rec) !== "undefined" && rec.recording) {
          return;
        }
        updateNav();
        let audio = document.getElementById("audio");
        if (!audio.paused && nowPlaying === "") {
          audio.pause();
        }
      });
      if (col !== "demoWaves") {
        document.getElementById("logout-button").addEventListener('click', () => {
          firebase.auth().signOut().then(function () {
            // The user has been successfully signed out
            activeUser = null;
            window.location.href = "/html/index.html";
          }).catch(function (error) {
            // An error occurred while signing out the user
            console.error(error);
          });
        });
        document.getElementById("now-nav-item").addEventListener('click', () => {
          if (pageProfile !== "all") {
            page("/html/app");
          }
        });
        document.getElementById("amped-nav-item").addEventListener('click', () => {
          if (pageProfile !== "#amped") {
            page("/amped");
          }
        });
        document.getElementById("loud-nav-item").addEventListener('click', () => {
          if (pageProfile !== "#loud") {
            page("/loud");
          }
        });
        document.getElementById("username-nav-item").addEventListener('click', () => {
          if (pageProfile !== activeUser.username) {
            page('@' + activeUser.username);
          }
        });
      }
      document.getElementById("message").addEventListener('input', () => {
        updateCharCount();
      });


      document.getElementById("title").addEventListener('click', () => {
        if (pageProfile !== "all" && pageSwap) {
          page("/html/app");
        }
        pageSwap = true;
      });



    } else {
      // User is not signed in
      page("/html/index.html");
    }
  });

}

var lastVisible;
var lastVisibleIndex;
var dataCount;
async function updateFeed(refresh = true, numberToFetch = 7) {
  let pageToLoad = livePage || "recent";
  let profile = pageProfile || "all";
  let orderByDate = false;
  console.log("pageToLoad:", pageToLoad, "profile:", profile);
  var messagesRef = firebase.firestore().collection(col);
  var usersRef = firebase.firestore().collection("users");

  var tbody = document.getElementById('tbody');
  if (refresh) {
    dataCount = 0;
    lastVisibleIndex = 0;
    // Get a reference to the table element
    tbody.innerHTML = "";
    let cards = document.querySelectorAll('.card');
    cards.forEach(function (card) {
      card.parentNode.removeChild(card);
    });
    //Create array of loaded waves 
    wavesLoaded = [];
    wavesToLoad = [];
  }

  switch (pageToLoad) {
    case "recent":
      if (pageProfile === "#loud") {
        buttonShow(false);
        messagesRef = messagesRef.where("score", ">", 0).orderBy("score", "desc").orderBy('timeStamp', 'desc');

      } else {
        buttonShow();
        messagesRef = messagesRef.orderBy('timeStamp', 'desc');

      }
      if (refresh) {
        messagesRef = messagesRef.limit(numberToFetch);
      } else {
        try {
          messagesRef = messagesRef.startAfter(lastVisible);
        } catch (err) {
          console.log(err);
          messagesRef = null;
          hidePlayButtonBottomOfPage();
          return false;
        }
        for (let i = 0; i <= numberToFetch; i++) {
          try {
            messagesRef = messagesRef.limit(numberToFetch - i);
            break;
          } catch (err) {
            console.log(err);
            messagesRef = null;
            hidePlayButtonBottomOfPage();
          }
        }
      }
      break;
    case "profile":
      if (numberToFetch > 10) {
        console.log("Number to fetch is greater than 10 not supported");
        console.log("Setting number to fetch to 10");
        numberToFetch = 10;
      }
      if (refresh) {
        var query;
        if (profile === "#amped") {
          document.getElementById("current-page-title").innerText = profile + " 🔊";
          query = usersRef.where("userID", "==", firebase.auth().currentUser.uid);
        } else {
          //check if user exists
          document.getElementById("current-page-title").innerText = "@" + profile;
          query = usersRef.where("username", "==", profile);
        }

        await query.get()
          .then(async function (querySnapshot) {
            if (querySnapshot.empty) {
              alert("No user found");
              return false;
            } else {
              querySnapshot.forEach(function (doc) {
                // Get the data for the document
                if (doc.data().userID === firebase.auth().currentUser.uid && !profile.includes("#")) {
                  buttonShow();
                } else {
                  buttonShow(false);
                }
                //swticth statement for profile
                switch (profile) {
                  case "#amped":
                    wavesToLoad = doc.data().amped;
                    break;
                  default:
                    wavesToLoad = doc.data().created;
                }
              });
            }
            const promises = [];
            for (let i = 0; i < wavesToLoad.length; i++) {
              let waveId = wavesToLoad[i];
              promises.push(
                messagesRef.doc(waveId).get().then(doc => {
                  if (!doc.exists) {
                    // Remove the wave ID from the wavesToLoad array if the document does not exist
                    wavesToLoad.splice(i, 1);
                    i--;
                  }
                })
              );
            }
            // Wait for all the promises to resolve before moving on
            await Promise.all(promises).then(() => {

              switch (profile) {
                case "#amped":
                  activeUser.amped = wavesToLoad;
                  break;
                default:
                  activeUser.created = wavesToLoad;
              }
              console.log("activeUser:", activeUser);
              updateActiveUser(activeUser);
            });

          })
          .catch(function (error) {
            console.log("Error getting documents: ", error);
            return false;
          });

        messagesRef = messagesRef.where(firebase.firestore.FieldPath.documentId(), "in", wavesToLoad.slice(numberToFetch * -1));

        lastVisibleIndex = wavesToLoad.length - numberToFetch;
        orderByDate = true;
      } else {
        if (lastVisibleIndex > 0) {
          let startingIndex = lastVisibleIndex - numberToFetch
          if (startingIndex < 0) {
            startingIndex = 0;
          }
          messagesRef = messagesRef.where(firebase.firestore.FieldPath.documentId(), 'in', wavesToLoad.slice(startingIndex, lastVisibleIndex));
          lastVisibleIndex -= numberToFetch;
        } else {
          hidePlayButtonBottomOfPage();
          return false;
        }
      }
      break;
    default:
  }
  // Retrieve the data from the collection
  messagesRef.get().then(function (querySnapshot) {
    let docs = querySnapshot.docs;
    // Loop through the documents in the collection
    if (orderByDate === true) {
      docs = docs.map(doc => doc.data());
      docs = docs.sort((a, b) => a.timeStamp < b.timeStamp ? 1 : -1);
      docs.forEach(function (doc) {
        var data = doc;
        // Check if the message is already in array
        if (!wavesLoaded.includes(data)) {
          data.id = doc.waveID;
          wavesLoaded.push(data);
        }
      });
    } else {
      docs.forEach(function (doc) {
        // Get the data for the document
        var data = doc.data();

        // Check if the message is already in array
        if (!wavesLoaded.includes(data)) {
          data.id = doc.id;
          wavesLoaded.push(data);
        }

      });
    }

    if (pageToLoad == "recent") {
      lastVisible = querySnapshot.docs[numberToFetch - 1];
    }

    let activeButton;

    for (let i = dataCount; i < wavesLoaded.length; i++) {
      dataCount++;
      let data = wavesLoaded[i];
      // Create a new row in the table
      const row = tbody.insertRow(0);
      const dataCount_ = tbody.rows.length;

      // Insert cells for the message and user
      const messageCell = row.insertCell(0);
      const userCell = row.insertCell(1);
      const timeStampCell = row.insertCell(2);
      const audioCell = row.insertCell(3);
      const scoreValueCell = row.insertCell(4);
      const scoreButtonsCell = row.insertCell(5);
      const deleteButtonCell = row.insertCell(6);

      // Set the cell values to the message and user
      messageCell.innerHTML = data.message;
      userCell.innerHTML = data.username;
      timeStampCell.innerHTML = data.timeStamp.toDate().toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
      // Get the audio file from Cloud Firestore
      const audioRef = firebase.storage().ref().child(data.audio);
      let playButton = document.createElement("button");

      playButton.innerHTML = "Play Audio";
      // Add a click event listener to the button

      playButton.addEventListener("click", function () {

        audio.addEventListener("loadeddata", function () {
          let playButton = document.getElementById("play-button");

          playButton.textContent = "Pause";

        });
        function audioEnded() {
          nowPlaying = "";
          let playButton = document.getElementById("play-button");

          setTimeout(function () {
            // Check the variable here
            if (audio.paused) {
              // Proceed with the rest of the code
              playButton.textContent = "Play";

            }
          }, 1000);
        };
        audio.addEventListener("ended", audioEnded);
        audio.addEventListener('pause', audioEnded);
        audio.addEventListener('play', function () {
          nowPlaying = data.audio;
          lastPlayed = dataCount_ - 1;
        });

        if (nowPlaying === data.audio && !audio.paused) {
          playThrough = false;
          audio.pause();
          return;
        }

        audioRef.getDownloadURL().then(function (url) {
          if (nowPlaying !== data.audio) {
            if (typeof (activeButton) !== "undefined") {
              activeButton.innerHTML = "Play Audio";
            }
            if (!audio.pause()) {
              audio.pause();
            }
            nowPlaying = data.audio;
            activeButton = playButton;
            audio.src = url;
            audio.currentTime = 0;
            audio.load();
            audio.play();
          } else if (nowPlaying === data.audio) {
            audio.currentTime = 0;
          }
        }).catch(function (error) {
          // Handle any errors
          console.log(error);
        });
      });

      if (typeof data.amped === "undefined") {
        data.amped = [];
      } if (typeof data.damped === "undefined") {
        data.damped = [];
      } if (typeof data.score === "undefined") {
        data.score = data.amped.length - data.damped.length;
      }

      let inAmped = data.amped.includes(selfUser);
      let inDamped = data.damped.includes(selfUser);

      audioCell.appendChild(playButton);

      const ampButton = document.createElement("button");
      ampButton.innerHTML = "🙌";
      ampButton.classList.add("ampButton");
      ampButton.addEventListener("click", function () {
        var beginScore = data.score;
        let found = data.amped.filter(o => o.user === selfUser.user && o.username === selfUser.username);
        if (found.length > 0) inAmped = true;
        else inAmped = false;

        found = data.damped.filter(o => o.user === selfUser.user && o.username === selfUser.username);
        if (found.length > 0) inDamped = true;
        else inDamped = false;

        if (!inAmped && !inDamped) {
          data.amped.push(selfUser);
          inAmped = true;
        } else if (inAmped && !inDamped) {
          data.amped.splice(data.amped.indexOf(selfUser), 1);
          inAmped = false;
        } else if (inDamped && !inAmped) {
          data.damped.splice(data.damped.indexOf(selfUser), 1);
          data.amped.push(selfUser);
          inAmped = true;
          inDamped = false;
        } else {
          let ids = data.damped.map(o => o.user);
          let filtered = data.damped.filter(({ id }, index) => !ids.includes(id, index + 1));
          for (let i of filtered) {
            data.damped.splice(i, 1);
          }
          ids = data.amped.map(o => o.user);
          filtered = data.amped.filter(({ id }, index) => !ids.includes(id, index + 1));
          for (let i of filtered) {
            data.amped.splice(i, 1);
          }

        }
        data.score = data.amped.length - data.damped.length
        if (beginScore !== data.score) {
          scoreValueCell.innerText = data.score;
          var updateVals = {};
          updateVals.score = data.score;
          updateVals.amped = data.amped;
          updateVals.damped = data.damped;
          updateWave(col, data.id, updateVals);
        }
        appendToAmped(activeUser, data.waveID);
      });
      const dampButton = document.createElement("button");
      dampButton.innerText = "🔇";
      dampButton.classList.add("damp");
      dampButton.addEventListener("click", function () {
        var beginScore = data.score;
        let found = data.amped.filter(o => o.user === selfUser.user && o.username === selfUser.username);
        if (found.length > 0) inAmped = true;
        else inAmped = false;

        found = data.damped.filter(o => o.user === selfUser.user && o.username === selfUser.username);
        if (found.length > 0) inDamped = true;
        else inDamped = false;

        if (!inAmped && !inDamped) {
          data.damped.push(selfUser);
          inDamped = true;
        } else if (inAmped && !inDamped) {
          data.amped.splice(data.amped.indexOf(selfUser), 1);
          data.damped.push(selfUser);
          inAmped = false;
          inDamped = true;
        } else if (inDamped && !inAmped) {
          data.damped.splice(data.damped.indexOf(selfUser), 1);
          inDamped = false;
        } else {
          let ids = data.damped.map(o => o.user);
          let filtered = data.damped.filter(({ id }, index) => !ids.includes(id, index + 1));
          for (let i of filtered) {
            data.damped.splice(i, 1);
          }
          ids = data.amped.map(o => o.user);
          filtered = data.amped.filter(({ id }, index) => !ids.includes(id, index + 1));
          for (let i of filtered) {
            data.amped.splice(i, 1);
          }

        }
        data.score = data.amped.length - data.damped.length
        if (beginScore !== data.score) {
          scoreValueCell.innerText = data.score;
          var updateVals = {};
          updateVals.score = data.score;
          updateVals.amped = data.amped;
          updateVals.damped = data.damped;
          updateWave(col, data.id, updateVals);
        }
        appendToDamped(activeUser, data.waveID);
      });
      scoreValueCell.innerText = data.score;
      scoreButtonsCell.appendChild(ampButton);
      scoreButtonsCell.appendChild(dampButton);

      let deleteButton = document.createElement("button");
      deleteButton.innerHTML = "Delete"

      if (col !== "demoWaves" && selfUser.user === data.user) {
        deleteButtonCell.appendChild(deleteButton);
      }
      deleteButton.addEventListener("click", function () {
        // Get a reference to the document that you want to remove
        var docRef = firebase.firestore().collection("waves").doc(data.id);

        // Get a reference to the file
        var fileRef = firebase.storage().ref(data.audio);
        document.getElementById("feed").deleteRow(wavesLoaded.length - wavesLoaded.indexOf(data));

        wavesLoaded.splice(wavesLoaded.indexOf(data), 1);
        // Delete the file
        fileRef.delete().then(function () {
          console.log("File successfully removed!");
        }).catch(function (error) {
          console.error("Error removing file: ", error);
        });
        // Delete the document
        docRef.delete().then(function () {

          console.log("Document successfully deleted!");

        }).catch(function (error) {
          console.error("Error removing document: ", error);
        });
        removeWave(activeUser, docRef.id);

      });
      if (dataCount > 0) {
        tableRowToCard(row, data, dataCount - 1);
      }
    }
  });
  return true;
}

function saveAudioToGCS(audioBlob, fileName) {

  // Create a storage reference from our storage service
  var storageRef = storage.ref();
  var audioRef = storageRef.child(AUDIO_PATH + fileName);
  // Upload the file
  var task = audioRef.put(audioBlob);
  // Listen for state changes, errors, and completion of the upload
  task.on(firebase.storage.TaskEvent.STATE_CHANGED, // or 'state_changed'
    function (snapshot) {
      // Get task progress, including the number of bytes uploaded and the total number of bytes to be uploaded
      var progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
      switch (snapshot.state) {
        case firebase.storage.TaskState.PAUSED: // or 'paused'
          // console.log('Upload is paused');
          break;
        case firebase.storage.TaskState.RUNNING: // or 'running'
          //console.log('Upload is running');
          break;
      }
    },
    function (error) {
      // A full list of error codes is available at
      // https://firebase.google.com/docs/storage/web/handle-errors
      switch (error.code) {
        case 'storage/unauthorized':
          console.log('User does not have permission to access the object.');
          break;
        case 'storage/canceled':
          console.log('User canceled the upload.');
          break;
        case 'storage/unknown':
          console.log('Unknown error occurred, inspect error.serverResponse');
          break;
      }
    },
    function () {
      console.log("Audio saved to " + fileName + " in bucket:" + "noize-22dc8.appspot.com");
      return
    });
}

function generateRandomString() {
  const crypto = window.crypto || window.msCrypto; // for IE 11
  const array = new Uint32Array(3);
  crypto.getRandomValues(array);
  let id = "";
  array.forEach((n) => id += n.toString(36));
  return id.substring(0, 24);
}

function updateWave(collection, documentId, updateVals) {
  var docRef = firebase.firestore().collection(collection).doc(documentId);
  var updateData = {};

  if (updateVals !== undefined) {
    for (var key in updateVals) {
      if (updateVals[key] !== undefined) {
        updateData[key] = updateVals[key];
      }
    }

    if (Object.keys(updateData).length === 0) {
      console.error("Error updating document: update vals is empty object");
    } else {
      docRef.update(updateData)
        .then(function () {
          //console.log("Document successfully updated!");
        })
        .catch(function (error) {
          console.error("Error updating document: ", error);
        });
    }
  } else {
    console.error("Error updating document: update vals is undefined");
  }
}

function uploadAudio(fileInput, newFileName) {
  const file = fileInput.files[0];
  var storageRef = storage.ref();
  var audioRef = storageRef.child(AUDIO_PATH + newFileName);

  // Create an audio element to hold the file
  var audioElement = new Audio();
  audioElement.src = URL.createObjectURL(file);

  // Compress audio using Web Audio API
  var context = new AudioContext();
  var compressor = context.createDynamicsCompressor();
  var source = context.createMediaElementSource(audioElement);
  source.connect(compressor);
  compressor.connect(context.destination);

  var task = audioRef.put(file);
  task.then(snapshot => {
    console.log("File uploaded successfully");
  }).catch(error => {
    console.log(error.message);
  });
  return task.then(snapshot => {
    return snapshot.ref.getDownloadURL();
  });
}

function getActiveUser(user, uid = '') {
  var collectionRef = firebase.firestore().collection("users");
  if (!uid) {
    uid = user.user.uid;
  }

  return collectionRef.where("userID", "==", uid)
    .get()
    .then(function (querySnapshot) {
      if (querySnapshot.empty) {
        console.log("No matching documents");
        activeUser = {
          amped: [],
          damped: [],
          created: [],
          userID: uid
        };
        return firebase.firestore().collection('users').add(activeUser)
      } else {
        return querySnapshot.forEach(function (doc) {
          activeUser = doc.data();
          activeUser.docID = doc.id;
        });
      }
    })
    .then(function (docRef) {
      if (docRef && docRef.id) {
        activeUser.docID = docRef.id;
        console.log("New user added with ID: ", uid);
      }
      return activeUser;
    })
    .catch(function (error) {
      console.log("Error getting documents: ", error);
    });
}

function generateSillyUsername() {
  const adjectives = ["Fluffy", "Silly", "Wiggly", "Funny", "Crazy", "Giggly"];
  const nouns = ["Monkey", "Elephant", "Unicorn", "Narwhal", "Giraffe", "Kangaroo"];
  const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
  return `${randomAdjective} ${randomNoun}`;
}

function updateActiveUser(activeUser) {
  var docRef = firebase.firestore().collection("users").doc(activeUser.docID);
  if (typeof activeUser.username !== undefined) {
    const res = docRef.set({
      username: generateSillyUsername()
    }, { merge: true });
  }
  firebase.firestore().collection('users').doc(activeUser.docID).update(activeUser
  ).then(() => {
    //console.log("Document successfully updated!");
  }).catch((error) => {
    console.error("Error updating document: ", error);
  });

}

function appendToAmped(activeUser, waveID) {
  const inAmped = activeUser.amped.includes(waveID);
  const inDamped = activeUser.damped.includes(waveID);
  if (!inAmped && !inDamped) {
    activeUser.amped.push(waveID);
  } else if (inAmped && !inDamped) {
    activeUser.amped.splice(activeUser.amped.indexOf(waveID), 1);
  } else if (!inAmped && inDamped) {
    activeUser.amped.push(waveID);
    activeUser.damped.splice(activeUser.damped.indexOf(waveID), 1);
  } else if (inAmped && inDamped) {
    while (activeUser.amped.includes(waveID)) {
      activeUser.amped.splice(activeUser.amped.indexOf(waveID), 1);
    }
    while (activeUser.damped.includes(waveID)) {
      activeUser.damped.splice(activeUser.damped.indexOf(waveID), 1);
      activeUser.amped.push(waveID);
    }
  }
  updateActiveUser(activeUser);
}
function appendToDamped(activeUser, waveID) {
  const inAmped = activeUser.amped.includes(waveID);
  const inDamped = activeUser.damped.includes(waveID);
  if (!inAmped && !inDamped) {
    activeUser.damped.push(waveID);
  } else if (!inAmped && inDamped) {
    activeUser.damped.splice(activeUser.damped.indexOf(waveID), 1);
  } else if (inAmped && !inDamped) {
    activeUser.damped.push(waveID);
    activeUser.amped.splice(activeUser.amped.indexOf(waveID), 1);
  } else if (inAmped && inDamped) {
    while (activeUser.amped.includes(waveID)) {
      activeUser.amped.splice(activeUser.amped.indexOf(waveID), 1);
    }
    while (activeUser.damped.includes(waveID)) {
      activeUser.damped.splice(activeUser.damped.indexOf(waveID), 1);
      activeUser.damped.push(waveID);
    }
  }
  updateActiveUser(activeUser);
}
function appendToCreated(activeUser, waveID) {
  activeUser.created.push(waveID);
  updateActiveUser(activeUser);
}

function removeWave(activeUser, waveID) {
  activeUser.created.splice(activeUser.created.indexOf(waveID), 1);
  const inAmped = activeUser.amped.includes(waveID);
  if (inAmped) {
    activeUser.amped.splice(activeUser.amped.indexOf(waveID), 1);
  }
  const inDamped = activeUser.damped.includes(waveID);
  if (inDamped) {
    activeUser.damped.splice(activeUser.damped.indexOf(waveID), 1);
  }
  updateActiveUser(activeUser);
}

function tableRowToCard(tr, data, cardNumber) {
  var card = document.createElement("div");
  card.classList.add("card");
  let deleteButtonHTML = '';
  let ampedActiveString = '';
  let dampedActiveString = '';

  if (data.user === activeUser.userID) {
    deleteButtonHTML = '<button class="deleteButton" id="deleteButton-' + tr.rowIndex + '">X</button>';
  }

  if (wavesLoaded[cardNumber].amped.some(user => user.user === activeUser.userID)) {
    ampedActiveString = 'active';
  } else if (wavesLoaded[cardNumber].damped.some(user => user.user === activeUser.userID)) {
    dampedActiveString = 'active';
  }
  let message = tr.cells[0].innerText;
  if (chatFilter(message)[1] === 'text') {

  } else if (chatFilter(message)[1] === 'image') {
    message = '<img class="image-wave" src="' + message + '" draggable="false"></img>'
  }
  document.addEventListener('contextmenu', event => event.preventDefault());

  card.innerHTML = `
    <div class="userCell"> 
      <h1 class="username-button"> @` + tr.cells[1].innerHTML + `</h1>
      <div class="textCell">
        <h2 class="prevent-select">` + tr.cells[2].innerHTML + `</h2>
        <h3>` + message + `</h3>
      </div>
    </div>
    <div class="buttonCell"> 
      <div class="deleteButtonParent">` +
    deleteButtonHTML +
    `</div>
      <div class="voteButtonParent">
        <button id="ampButton" class="voteButton ` + ampedActiveString + `"> 🔊 </button>
        <p class="score">` + tr.cells[4].innerHTML + `</p>
        <button id="dampButton" class="voteButton ` + dampedActiveString + `"> 🔇 </button>
      </div>
    </div>`;
  card.id = "card-" + cardNumber;

  document.getElementById("card-feed").appendChild(card);
  const textCell = card.getElementsByClassName("textCell")[0];
  textCell.addEventListener("click", function (event) {
    if (playThrough && event["isTrusted"] !== false) {
      playThrough = false;
      document.getElementById("play-button").click();
    }
    tr.getElementsByTagName("td")[3].querySelector("button").click();
    var activeCard = document.querySelector(".card.active");
    if (activeCard !== null) {
      activeCard.classList.remove("active");
    }
    card.classList.add("active");
  });
  if (col !== "demoWaves") {
    const cardUsername = card.getElementsByTagName("h1")[0];
    if (cardUsername.innerText !== document.getElementById("current-page-title").innerText) {
      cardUsername.addEventListener("click", function (event) {
        page('@' + tr.cells[1].innerText);
      });
    }
  }
  if (deleteButtonHTML) {
    let deleteButton = card.getElementsByClassName("deleteButton")[0];
    deleteButton.addEventListener("click", function (event) {
      if (event.target === deleteButton) {
        if (confirm('Are you sure you want to delete this wave? \n "' + data.message)) {
          tr.getElementsByTagName("td")[6].querySelector("button").click();
          card.remove();
        }

      }
    });
  }
  const ampButton = card.getElementsByClassName("voteButton")[0];
  const dampButton = card.getElementsByClassName("voteButton")[1];
  const score = card.getElementsByClassName("score")[0];
  ampButton.addEventListener("click", function (event) {
    ampButton.classList.toggle("active");
    if (ampButton.classList.contains("active")) {
      score.innerHTML = (Number(tr.cells[4].innerHTML) + 1).toString();
    } else {
      score.innerHTML = tr.cells[4].innerHTML;
    }
    if (dampButton.classList.contains("active")) {
      dampButton.classList.toggle("active");
    }
    if (col !== "demoWaves") {
      tr.getElementsByTagName("td")[5].querySelector("button").click();
    }

  });
  dampButton.addEventListener("click", function (event) {
    dampButton.classList.toggle("active");
    if (dampButton.classList.contains("active")) {
      score.innerHTML = (Number(tr.cells[4].innerHTML) - 1).toString();
    } else {
      score.innerHTML = tr.cells[4].innerHTML;
    }
    if (ampButton.classList.contains("active")) {
      ampButton.classList.toggle("active");
    }
    if (col !== "demoWaves") {
      tr.getElementsByTagName("td")[5].querySelectorAll("button")[1].click();
    }
  });

}

function chatFilter(string) {
  let filteredWords = ["badwords"];

  //Check if string is has less that 300 characters
  if (string.length > 300) {
    return [false, "tooLong"];
  }

  //check if string is a valid image url
  if (string.includes(".jpg") || string.includes(".png") || string.includes(".gif")) {
    let givenURL;
    try {
      givenURL = new URL(string);
    } catch (error) {
      console.log("error is", error);
    }
    if (givenURL.protocol === "http:" || givenURL.protocol === "https:") {
      return [true, "image"];
    }
    return [false, "badLink"];
  }

  //Check if the string contains any of the filtered words
  if (filteredWords.indexOf(string) !== -1) {
    return [false, "badWord"];
  }
  return [true, "string"];
}
function navbarClickListener(event) {
  if (!navbar.contains(event.target)) {
    navbar.classList.remove("show");
    navbar.classList.remove("fixed");
    document.removeEventListener("click", navbarClickListener);
  }
}
function updateNav(show = "") {
  const navbar = document.getElementById("navbar");

  if ((!navbar.classList.contains("show") || show === "show") && show !== "hide") {
    navbar.classList.add("show");
    navbar.classList.add("fixed");
    setTimeout(() => {
      document.addEventListener("click", navbarClickListener);
    }, 500);

  } else {
    navbar.classList.remove("show");
    navbar.classList.remove("fixed");
    document.removeEventListener("click", navbarClickListener);
  }
  document.getElementById("wave").classList.remove("show");
  document.getElementById('start-button').innerText = "Make Some Noize!";
  document.getElementById('message').value = "";


  if (document.getElementById("current-page-title").innerText === "@all") {
    document.getElementById("current-page-title").classList.add("active");
  }
  let navItem = document.querySelectorAll(".nav-item");
  for (let i = 0; i < navItem.length; i++) {
    navItem[i].classList.remove("active");
  }
  document.getElementById("current-page-title").classList.remove("active");
  if (pageProfile === "#amped") {
    navItem[2].classList.add("active");
  } else if (pageProfile === "#loud") {
    navItem[1].classList.add("active");
  } else if (livePage === "profile") {
    if (pageProfile === document.getElementById("username-nav-item").innerText.slice(1)) {
      navItem[3].classList.add("active");
    }

  } else if (livePage === "recent") {
    navItem[0].classList.add("active");
  }
}

function buttonShow(button = true) {
  let spacers = document.getElementsByClassName("spacer");
  if (button) {
    document.getElementById("start-button").style.display = "block";
    for (let i = spacers.length - 1; i >= 0; i--) {
      spacers[i].remove();
    }
  } else {
    if (spacers.length < 1) {
      document.getElementById("start-button").style.display = "none";
      let spacer = document.createElement("div");
      spacer.classList.add("spacer");
      spacer.style.marginTop = "60px";
      var element = document.getElementById("card-feed");
      element.appendChild(spacer);
    }
  }

}

function isValidEmail(email) {
  // Regular expression to check for valid email address
  let regex = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return regex.test(email);
}

async function spamCheck() {
  let wavesToCheck = [];
  let strikes = 0;
  let now;
  let lastCreated;
  //check if user exists
  var usersRef = firebase.firestore().collection("users").where("userID", "==", firebase.auth().currentUser.uid);
  await usersRef.get()
    .then(function (querySnapshot) {
      if (querySnapshot.empty) {
        console.log("No matching documents.");
        return false;
      } else {
        querySnapshot.forEach(function (doc) {
          // Get the data for the document
          wavesToCheck = doc.data().created.slice(-3);
        });
      }
    })
    .catch(function (error) {
      console.log("Error getting documents: ", error);
      return false;
    });
  //check if user has created waves in the last 7 minutes
  for (let i = wavesToCheck.length - 1; i >= 0; i--) {
    const docRef = firebase.firestore().collection(col).doc(wavesToCheck[i]);
    await docRef.get().then(function (doc) {
      if (doc.exists) {
        let created = doc.data().timeStamp.toDate();
        if (i === wavesToCheck.length - 1) {
          now = new Date();
        } else {
          now = lastCreated;
        }



        let diff = now - created;
        lastCreated = created;
        if (diff < 600000) {
          strikes++;
        }
      } else {
        // doc.data() will be undefined in this case
        console.log("No such document!");
      }
    });

  }
  if (strikes < 3) {
    return true;
  }
  return false;
}

function updateCharCount() {
  let charCount = document.getElementById("message").value.length;
  let timeLeft = (30 - recordingTime) || 0;
  let charLeft = 300 - charCount;
  if (charLeft < 0) {
    document.getElementById("countdown-text").style.color = "red";
  } else {
    document.getElementById("countdown-text").style.color = "gray";
  }
  if (rec && rec.recording) {
    document.getElementById("countdown-text").innerText = timeLeft.toString() + "s : " + charLeft.toString() + "c";
  } else {
    document.getElementById("countdown-text").innerText = charLeft.toString() + "c";
  }
}

function hidePlayButtonBottomOfPage() {
  let bottom = window.innerHeight + window.scrollY;
  setTimeout(function () {
    let button;
    if (bottom === window.innerHeight + window.scrollY) {
      if (!document.getElementById("play-button").classList.contains("hide")) {
        button = 0;
        document.getElementById("play-button").classList.toggle("hide");
      } else if (!document.getElementById("play-button-audio").classList.contains("hide")) {
        document.getElementById("play-button-audio").classList.toggle("hide");
        button = 1;
      }
    }
    function checkForBottom() {
      if (bottom !== window.innerHeight + window.scrollY) {
        if (button === 0) {
          document.getElementById("play-button").classList.toggle("hide");
        } else if (button === 1) {
          document.getElementById("play-button-audio").classList.toggle("hide");
        }
        window.removeEventListener('scroll', checkForBottom);
      }
    }
    window.addEventListener('scroll', checkForBottom);
  }, 3000);
}

function createDownloadLink(inputBlob) {
  blob = inputBlob
  audioURL = URL.createObjectURL(blob);
  var au = document.getElementById('audio');

  au.src = audioURL;
  au.load();
  au.play();
}