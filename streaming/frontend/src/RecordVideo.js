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
import { ENDPOINT } from "./Config";
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
          onRecordingStarted={({ uri }) => {
            console.log("Recording started", uri);
            this.recordingStarted(uri);
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

  async readCurrentFile(uri, existingData = "", startAtPosition = 0) {
    let receivedUntil = 0;
    let data = existingData;
    const stream = await RNFetchBlob.fs.readStream(uri, "base64");
    stream.open();
    console.log("opening stream");

    return new Promise(resolve => {
      stream.onData(chunk => {
        console.log("chunk length", chunk);
        receivedUntil += chunk.length;

        if (receivedUntil <= startAtPosition) {
          // Do nothing, we already added this part
          console.log("already added, doing nothing");
          return;
        }

        if (startAtPosition < receivedUntil) {
          // We got a partial match, so we need to add what hasn't been added
          const length = receivedUntil - startAtPosition;
          console.log("needing to add a partial of length", length);
          const startOfChunk = Math.min(chunk.length - length, 0);

          data += chunk.slice(startOfChunk);
          return;
        }
        console.debug("Fallthrough case :/", receivedUntil, startAtPosition);
      });

      stream.onEnd(() => {
        console.log("onEnd");
        if (this.state.recording) {
          this.readCurrentFile(uri, data, receivedUntil).then(resolve);
        } else {
          resolve(data);
        }
      });
    });
  }

  async recordingStarted(uri) {
    const data = await this.readCurrentFile(uri);
    console.log("End Result", data);
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
