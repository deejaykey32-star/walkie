/**
 * @file sdpUtils.ts
 * @description Moduł obsługi bezserwerowych ofert i odpowiedzi WebRTC (Serverless SDP).
 * Tworzy pełne obiekty SDP (dopiero PO zakończeniu zbierania kandydatów ICE)
 * do generowania kodów QR i linków bez konieczności użycia zewnętrznego serwera sygnalizacyjnego.
 */

export const ICE_SERVERS_CONFIG: RTCConfiguration = {
  iceServers: [
    // Publiczne, stabilne serwery STUN Google
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },

    /*
     * MIEJSCE NA SERWER TURN (Wymagane dla połączeń w sieciach komórkowych 4G/5G / Symetryczny NAT):
     * Aby włączyć serwer TURN, odkomentuj poniższy bloku i podaj dane dostępowe (np. z Coturn / Metered / Twilio):
     *
    {
      urls: [
        'turn:your-turn-server.com:3478?transport=udp',
        'turn:your-turn-server.com:3478?transport=tcp',
        'turns:your-turn-server.com:5349?transport=tcp'
      ],
      username: 'wt_user',
      credential: 'wt_secure_password',
      credentialType: 'password'
    }
    */
  ],
  iceCandidatePoolSize: 10,
};

/**
 * Koduje obiekt SDP do zwięzłego ciągu Base64 przyjaznego dla adresów URL i kodów QR.
 */
export function encodeSdpPayload(data: object): string {
  try {
    const jsonStr = JSON.stringify(data);
    return btoa(unescape(encodeURIComponent(jsonStr)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  } catch (e) {
    console.error('[SDP Utils] Błąd kodowania SDP do Base64:', e);
    return '';
  }
}

/**
 * Dekoduje ciąg Base64 z adresu URL lub kodu QR z powrotem do obiektu SDP.
 */
export function decodeSdpPayload<T = any>(encodedStr: string): T | null {
  try {
    let base64 = encodedStr.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const jsonStr = decodeURIComponent(escape(atob(base64)));
    return JSON.parse(jsonStr) as T;
  } catch (e) {
    console.error('[SDP Utils] Błąd dekodowania ciągu SDP Base64:', e);
    return null;
  }
}

/**
 * Czeka na pełne zakończenie zbierania kandydatów ICE (icegatheringstatechange === 'complete').
 * Naprawia błąd niepełnych kodów QR / linków serverless.
 */
export function waitForIceGatheringComplete(pc: RTCPeerConnection, timeoutMs = 5000): Promise<void> {
  return new Promise((resolve) => {
    // Jeśli zbieranie kandydatów ICE już się zakończyło, zwracamy od razu
    if (pc.iceGatheringState === 'complete') {
      console.log('[WebRTC ICE] Zbieranie kandydatów ICE było już zakończone (complete).');
      resolve();
      return;
    }

    let timer: ReturnType<typeof setTimeout>;

    const handleIceStateChange = () => {
      console.log('[WebRTC ICE] Zmiana stanu zbierania ICE:', pc.iceGatheringState);
      if (pc.iceGatheringState === 'complete') {
        cleanup();
        resolve();
      }
    };

    const cleanup = () => {
      pc.removeEventListener('icegatheringstatechange', handleIceStateChange);
      if (timer) clearTimeout(timer);
    };

    // Nasłuchiwanie na zdarzenie icegatheringstatechange
    pc.addEventListener('icegatheringstatechange', handleIceStateChange);

    // Timeout zabezpieczający na przypadek opóźnień w sieci
    timer = setTimeout(() => {
      console.warn(`[WebRTC ICE] Zbieranie kandydatów ICE przekroczyło limit czasu (${timeoutMs}ms). Używanie dotychczas zebranych kandydatów.`);
      cleanup();
      resolve();
    }, timeoutMs);
  });
}

/**
 * Generuje bezserwerową ofertę SDP (Serverless Offer) po pełnym zebraniu ICE.
 */
export async function generateServerlessOfferSdp(stream?: MediaStream | null): Promise<{
  pc: RTCPeerConnection;
  sdpPayload: string;
}> {
  console.log('[Serverless SDP] Tworzenie oferty WebRTC...');
  const pc = new RTCPeerConnection(ICE_SERVERS_CONFIG);

  // Dodajemy kanał danych do komunikacji PTT
  pc.createDataChannel('wt-signal-channel');

  // Jeśli dostępny jest strumień mikrofonu, dodajemy go do połączenia
  if (stream) {
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));
  }

  // Tworzymy ofertę i ustawiamy opis lokalny
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  // KLUCZOWY KROK: Czekamy na zakończenie zbierania kandydatów ICE!
  await waitForIceGatheringComplete(pc);

  const completeSdp = pc.localDescription?.sdp || offer.sdp || '';
  const sdpPayload = encodeSdpPayload({ type: 'offer', sdp: completeSdp });

  return { pc, sdpPayload };
}

/**
 * Akceptuje bezserwerową ofertę SDP i generuje bezserwerową odpowiedź SDP (Serverless Answer) po pełnym zebraniu ICE.
 */
export async function generateServerlessAnswerSdp(
  offerSdp: string,
  stream?: MediaStream | null
): Promise<{
  pc: RTCPeerConnection;
  sdpPayload: string;
}> {
  console.log('[Serverless SDP] Przetwarzanie oferty i generowanie odpowiedzi...');
  const pc = new RTCPeerConnection(ICE_SERVERS_CONFIG);

  if (stream) {
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));
  }

  await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: offerSdp }));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  // KLUCZOWY KROK: Czekamy na zakończenie zbierania kandydatów ICE dla odpowiedzi!
  await waitForIceGatheringComplete(pc);

  const completeSdp = pc.localDescription?.sdp || answer.sdp || '';
  const sdpPayload = encodeSdpPayload({ type: 'answer', sdp: completeSdp });

  return { pc, sdpPayload };
}
