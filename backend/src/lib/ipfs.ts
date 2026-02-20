/**
 * IPFS Integration using Pinata
 * Uploads and fetches JSON data to/from IPFS
 */

const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_SECRET = process.env.PINATA_SECRET;
const PINATA_JWT = process.env.PINATA_JWT;

const PINATA_API_URL = 'https://api.pinata.cloud';
const PINATA_GATEWAY = process.env.PINATA_GATEWAY || 'https://gateway.pinata.cloud';

/**
 * Upload JSON data to IPFS via Pinata
 * @param data - Object to upload as JSON
 * @returns ipfs:// URI
 */
export async function uploadToIPFS(data: object): Promise<string> {
  if (!PINATA_API_KEY && !PINATA_JWT) {
    throw new Error('PINATA_API_KEY or PINATA_JWT must be set');
  }

  try {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    // Support both JWT and API key/secret auth
    if (PINATA_JWT) {
      headers['Authorization'] = `Bearer ${PINATA_JWT}`;
    } else if (PINATA_API_KEY && PINATA_SECRET) {
      headers['pinata_api_key'] = PINATA_API_KEY;
      headers['pinata_secret_api_key'] = PINATA_SECRET;
    }

    const response = await fetch(`${PINATA_API_URL}/pinning/pinJSONToIPFS`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        pinataContent: data,
        pinataMetadata: {
          name: `erc8004-${Date.now()}.json`,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Pinata upload failed: ${response.status} - ${error}`);
    }

    const result = await response.json();
    const cid = result.IpfsHash;

    return `ipfs://${cid}`;
  } catch (error: any) {
    console.error('[IPFS] Upload failed:', error);
    throw new Error(`IPFS upload failed: ${error.message}`);
  }
}

/**
 * Fetch JSON data from IPFS
 * @param uri - ipfs:// URI or HTTP gateway URL
 * @returns Parsed JSON object
 */
export async function fetchFromIPFS(uri: string): Promise<any> {
  try {
    let url: string;

    if (uri.startsWith('ipfs://')) {
      const cid = uri.replace('ipfs://', '');
      url = `${PINATA_GATEWAY}/ipfs/${cid}`;
    } else if (uri.startsWith('http://') || uri.startsWith('https://')) {
      url = uri;
    } else {
      throw new Error(`Invalid IPFS URI format: ${uri}`);
    }

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`IPFS fetch failed: ${response.status} - ${response.statusText}`);
    }

    return await response.json();
  } catch (error: any) {
    console.error('[IPFS] Fetch failed:', error);
    throw new Error(`IPFS fetch failed: ${error.message}`);
  }
}

/**
 * Test IPFS connectivity
 */
export async function testIPFS(): Promise<boolean> {
  try {
    const testData = {
      test: true,
      timestamp: Date.now(),
      message: 'ERC-8004 IPFS test',
    };

    const uri = await uploadToIPFS(testData);
    const fetched = await fetchFromIPFS(uri);

    return fetched.test === true && fetched.message === testData.message;
  } catch (error) {
    console.error('[IPFS] Test failed:', error);
    return false;
  }
}
