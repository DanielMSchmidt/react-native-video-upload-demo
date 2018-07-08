"use strict";
import React, { Component } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { RNCamera } from "react-native-camera";
import { WS_ENDPOINT } from "./Config";
import RNFetchBlob from "react-native-fetch-blob";

const FS_INTERVAL = 50;

export default class RecordVideo extends Component {
  constructor() {
    super();

    this.state = {
      recording: false,
      processing: false
    };
  }
  render() {
    const { recording, processing } = this.state;

    let button = (
      <TouchableOpacity
        onPress={this.startRecording.bind(this)}
        style={styles.capture}
      >
        <Text style={{ fontSize: 14 }}> RECORD </Text>
      </TouchableOpacity>
    );

    if (recording) {
      button = (
        <TouchableOpacity
          onPress={this.stopRecording.bind(this)}
          style={styles.capture}
        >
          <Text style={{ fontSize: 14 }}> STOP </Text>
        </TouchableOpacity>
      );
    }

    if (processing) {
      button = (
        <View style={styles.capture}>
          <ActivityIndicator animating size={18} />
        </View>
      );
    }

    return (
      <View style={styles.container}>
        <RNCamera
          ref={ref => {
            this.camera = ref;
          }}
          style={styles.preview}
          type={RNCamera.Constants.Type.back}
          flashMode={RNCamera.Constants.FlashMode.on}
          permissionDialogTitle={"Permission to use camera"}
          permissionDialogMessage={
            "We need your permission to use your camera phone"
          }
          onRecordingStarted={async ({ uri }) => {
            console.log("Recording started", uri);
            const data = await this.recordingStarted(uri);
            console.log("recording done", data);
          }}
        />
        <View
          style={{ flex: 0, flexDirection: "row", justifyContent: "center" }}
        >
          {button}
        </View>
      </View>
    );
  }

  async recordingStarted(uri) {
    let data = "";
    const ws = new WebSocket(WS_ENDPOINT);
    ws.onerror = e => {
      // an error occurred
      console.log("Websocket error", e);
    };

    await new Promise((resolve, reject) => {
      ws.onopen = async () => {
        const stream = await RNFetchBlob.fs.readStream(
          uri,
          "base64"
          // undefined,
          // 1000
        );
        stream.onEnd(() => {
          console.log("onEnd");
          ws.close();
          resolve(data);
        });
        stream.onError(reject);

        stream.onData(chunk => {
          data += chunk;
          ws.send(chunk);
        });

        stream.open();
      };
    });
  }

  async startRecording() {
    this.setState({ recording: true });
    // default to mp4 for android as codec is not set
    const { uri, codec = "mp4" } = await this.camera.recordAsync();
    console.log("Record async finished");

    // stop file watching & send the rest
    // this.setState({ recording: false, processing: true });
    this.setState({ processing: false, recording: false });
  }

  stopRecording() {
    console.log("STOP RECORDING IS CALLED");
    this.camera.stopRecording();
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: "column",
    backgroundColor: "black"
  },
  preview: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "center"
  },
  capture: {
    flex: 0,
    backgroundColor: "#fff",
    borderRadius: 5,
    padding: 15,
    paddingHorizontal: 20,
    alignSelf: "center",
    margin: 20
  }
});
