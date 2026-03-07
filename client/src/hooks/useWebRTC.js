import { useState, useCallback, useEffect, useRef } from 'react';
import * as ws from '../lib/ws';

export function useWebRTC(roomId, userId, { onTransferStart, onTransferComplete, onFileReceived } = {}) {
  const [peerConnection, setPeerConnection] = useState(null);
  const [dataChannel, setDataChannel] = useState(null);
  const [transferProgress, setTransferProgress] = useState(0);
  const [incomingFile, setIncomingFile] = useState(null);
  const fileBuffer = useRef([]);
  const incomingMetadataRef = useRef(null);

  const setupPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        ws.sendICECandidate(roomId, event.candidate);
      }
    };

    pc.ondatachannel = (event) => {
      const channel = event.channel;
      setupDataChannel(channel);
    };

    setPeerConnection(pc);
    return pc;
  }, [roomId, userId]); // Added userId to dependencies for completeness

  const setupDataChannel = useCallback((channel) => {
    channel.onopen = () => {
      console.log('[WebRTC] Data channel open');
      // If we have a pending file, send it now
      if (pendingFile.current) {
        const file = pendingFile.current;
        pendingFile.current = null; // Clear it immediately
        sendFile(file);
      }
    };
    channel.onclose = () => console.log('[WebRTC] Data channel closed');
    channel.onmessage = (event) => {
      if (typeof event.data === 'string') {
        const msg = JSON.parse(event.data);
        if (msg.type === 'file-start') {
          console.log('[WebRTC] Receiving file:', msg.fileInfo.name);
          incomingMetadataRef.current = msg.fileInfo;
          setIncomingFile(msg.fileInfo);
          fileBuffer.current = [];
          setTransferProgress(0);
        } else if (msg.type === 'file-end') {
          const fileInfo = incomingMetadataRef.current || {};
          console.log('[WebRTC] File receive complete:', fileInfo.name);
          
          const blob = new Blob(fileBuffer.current, { type: fileInfo.type || 'application/octet-stream' });
          const url = URL.createObjectURL(blob);
          const completedFile = { ...fileInfo, url, completed: true };
          
          setIncomingFile(completedFile);
          setTransferProgress(100);
          onFileReceived?.(completedFile);
          incomingMetadataRef.current = null;
        }
      } else {
        fileBuffer.current.push(event.data);
      }
    };
    setDataChannel(channel);
  }, [onFileReceived]); // Removed incomingFile from dependencies to keep onmessage stable

  const initCall = async () => {
    const pc = setupPeerConnection();
    const channel = pc.createDataChannel('fileTransfer');
    setupDataChannel(channel);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    ws.sendWebRTCOffer(roomId, offer);
  };

  useEffect(() => {
    const unsubOffer = ws.on('webrtc-offer', async (msg) => {
      if (msg.from === userId) return;
      const pc = setupPeerConnection();
      await pc.setRemoteDescription(new RTCSessionDescription(msg.payload));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      ws.sendWebRTCAnswer(roomId, answer);
    });

    const unsubAnswer = ws.on('webrtc-answer', async (msg) => {
      if (msg.from === userId) return;
      if (peerConnection) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(msg.payload));
      }
    });

    const unsubIce = ws.on('webrtc-ice-candidate', async (msg) => {
      if (msg.from === userId) return;
      if (peerConnection) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(msg.payload));
      }
    });

    return () => {
      unsubOffer();
      unsubAnswer();
      unsubIce();
    };
  }, [roomId, userId, peerConnection, setupPeerConnection]);

  const pendingFile = useRef(null);

  const sendFile = useCallback(async (file) => {
    if (!dataChannel || dataChannel.readyState !== 'open') {
      console.log('[WebRTC] Initiating P2P connection for file transfer...');
      pendingFile.current = file;
      await initCall();
      return; 
    }

    console.log(`[WebRTC] Sending file: ${file.name} (${file.size} bytes)`);
    onTransferStart?.({ name: file.name, size: file.size, type: file.type });

    dataChannel.send(JSON.stringify({ 
      type: 'file-start', 
      fileInfo: { name: file.name, size: file.size, type: file.type } 
    }));

    const chunkSize = 16384; // 16KB
    const reader = new FileReader();
    let offset = 0;

    reader.onload = (e) => {
      if (dataChannel.readyState !== 'open') {
        console.error('[WebRTC] Data channel closed during transfer');
        return;
      }
      dataChannel.send(e.target.result);
      offset += e.target.result.byteLength;
      setTransferProgress(Math.round((offset / file.size) * 100));

      if (offset < file.size) {
        readSlice(offset);
      } else {
        dataChannel.send(JSON.stringify({ type: 'file-end' }));
        console.log('[WebRTC] File transfer complete');
        onTransferComplete?.({ name: file.name, size: file.size, type: file.type });
        pendingFile.current = null;
      }
    };

    const readSlice = (o) => {
      const slice = file.slice(o, o + chunkSize);
      reader.readAsArrayBuffer(slice);
    };

    readSlice(0);
  }, [dataChannel, onTransferStart, onTransferComplete, roomId]);

  // Removed the useEffect that was triggering sendFile on dataChannel open, 
  // replacing it with direct logic in setupDataChannel.onopen to avoid dependency loops.


  return { sendFile, transferProgress, incomingFile, setIncomingFile };
}
