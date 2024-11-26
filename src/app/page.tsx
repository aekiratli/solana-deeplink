"use client";
import { useCallback, useState, useEffect } from "react";
import nacl from "tweetnacl";
import bs58 from "bs58";

// Constants
const PHANTOM_CONNECT_URL = "https://phantom.app/ul/v1/connect";
const APP_URL = "https://solana-deeplink.vercel.app.com"; // Replace with your app URL

export default function Home() {
  const [connecting, setConnecting] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  // const [session, setSession] = useState<string | null>(null);
  const [dappKeyPair] = useState(() => nacl.box.keyPair());

  const generateEncryptionKeyPair = useCallback(() => {
    return {
      publicKey: bs58.encode(dappKeyPair.publicKey),
      secretKey: dappKeyPair.secretKey
    };
  }, [dappKeyPair]);

  const handlePhantomConnect = useCallback(async () => {
    try {
      setConnecting(true);
      const phantomInstalled = window?.phantom?.solana?.isPhantom;

      if (phantomInstalled) {
        try {
          const response = await window.phantom?.solana?.connect();
          setPublicKey(response?.publicKey.toString());
        } catch (err) {
          console.error("Connection error:", err);
        }
      } else {
        const keypair = generateEncryptionKeyPair();
        const params = new URLSearchParams({
          app_url: APP_URL,
          dapp_encryption_public_key: keypair.publicKey,
          redirect_link: window.location.href,
          cluster: "devnet"
        });

        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        
        if (isMobile) {
          window.location.href = `${PHANTOM_CONNECT_URL}?${params.toString()}`;
        } else {
          window.open(`${PHANTOM_CONNECT_URL}?${params.toString()}`, '_blank');
        }

        // Store the secret key for later decryption
        localStorage.setItem('phantom_secret_key', bs58.encode(keypair.secretKey));
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setConnecting(false);
    }
  }, [generateEncryptionKeyPair]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const phantomEncryptionPublicKey = urlParams.get('phantom_encryption_public_key');
    const nonce = urlParams.get('nonce');
    const data = urlParams.get('data');

    if (phantomEncryptionPublicKey && nonce && data) {
      const secretKeyBase58 = localStorage.getItem('phantom_secret_key');
      if (!secretKeyBase58) {
        console.error("Secret key not found in local storage");
        return;
      }

      const secretKey = bs58.decode(secretKeyBase58);
      if (secretKey.length !== nacl.box.secretKeyLength) {
        console.error("Invalid secret key length");
        return;
      }

      const sharedSecretDapp = nacl.box.before(
        bs58.decode(phantomEncryptionPublicKey),
        secretKey
      );

      console.log("Shared Secret:", sharedSecretDapp);

      const decryptedData = nacl.box.open.after(
        bs58.decode(data),
        bs58.decode(nonce),
        sharedSecretDapp
      );

      if (decryptedData) {
        const decodedData = JSON.parse(new TextDecoder().decode(decryptedData));
        setPublicKey(decodedData.public_key);
        // setSession(decodedData.session);
        console.log("Decrypted Data:", decodedData);
      } else {
        console.error("Failed to decrypt data");
      }
    }
  }, [dappKeyPair.secretKey]);

  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20">
      <div className="text-center">
        <button
          onClick={handlePhantomConnect}
          disabled={connecting}
          className={`bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg transition-colors ${connecting ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {connecting ? 'Connecting...' : publicKey ? 'Connected' : 'Connect Phantom Wallet'}
        </button>
        <div className="mt-2 text-sm text-gray-600">
          {publicKey ? `Connected: ${publicKey.slice(0, 4)}...${publicKey.slice(-4)}` : 'Not connected'}
        </div>
      </div>
    </div>
  );
}