const express = require("express");
const WebSocket = require("ws");
const mic = require("mic");
require("dotenv").config();

const gladiaKey = process.env.GLADIA_KEY || '4eaa4808-b300-472e-a681-7c5ee0b6648f';
const gladiaUrl = "wss://api.gladia.io/audio/text/audio-transcription";
const SAMPLE_RATE = 16000;

if (!gladiaKey) {
  console.error("You must provide a Gladia key. Go to app.gladia.io");
  process.exit(1);
} else {
  console.log("Using the Gladia key: " + gladiaKey);
}

const app = express();
const server = app.listen(3000, () => {
  console.log("Server is listening on port 3000");
});

const wss = new WebSocket.Server({ server });

wss.on("connection", (ws) => {
  console.log("Client connected");

  const gladiaWs = new WebSocket(gladiaUrl);

  gladiaWs.on("open", () => {
    const configuration = {
      x_gladia_key: gladiaKey,
      language_behaviour: "automatic single language",
      sample_rate: SAMPLE_RATE,
      encoding: "WAV",
    };
    gladiaWs.send(JSON.stringify(configuration));

    ws.on("message", (message) => {
      gladiaWs.send(message);
    });

    const microphone = mic({
      rate: SAMPLE_RATE,
      channels: "1",
    });

    const microphoneInputStream = microphone.getAudioStream();
    microphoneInputStream.on("data", function (data) {
      const base64 = data.toString("base64");
      if (gladiaWs.readyState === WebSocket.OPEN) {
        gladiaWs.send(JSON.stringify({ frames: base64 }));
      } else {
        console.log("Gladia WebSocket ready state is not [OPEN]");
      }
    });

    microphoneInputStream.on("error", function (err) {
      console.log("Error in Input Stream: " + err);
    });

    microphone.start();
  });

  gladiaWs.on("message", (event) => {
    const utterance = JSON.parse(event.toString());
    console.log(utterance);
    ws.send(JSON.stringify(utterance));
  });

  gladiaWs.on("error", (error) => {
    console.log("An error occurred:", error.message);
  });

  gladiaWs.on("close", () => {
    console.log("Gladia connection closed");
  });

  ws.on("close", () => {
    console.log("Client disconnected");
    gladiaWs.close();
  });
});

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});
