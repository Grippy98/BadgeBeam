import { BleClient, numbersToDataView } from '@capacitor-community/bluetooth-le';

// Custom UUIDs defined for the BadgeBeam application
export const BADGE_SERVICE_UUID = '12345678-1234-5678-1234-56789abcdef0';
export const DISPLAY_CHAR_UUID = '12345678-1234-5678-1234-56789abcdef1';

// We chunk the 15,000 bytes so we don't overwhelm the MTU limit
const CHUNK_SIZE = 120; // Safe for most BLE devices without extending MTU

let connectedDeviceId = null;

export const initializeBle = async () => {
    try {
        await BleClient.initialize();
        return true;
    } catch (e) {
        console.error('BLE Initialization failed', e);
        return false;
    }
};

export const connectToBadge = async (onDisconnect) => {
    try {
        await BleClient.initialize();
        
        const device = await BleClient.requestDevice({
            // Chrome strictly filters devices when scanning. We need to accept all and allow
            // the user to pick "P-PRE3 EntOS RCU" or "BeagleBadge" manually.
            acceptAllDevices: true,
            optionalServices: [BADGE_SERVICE_UUID]
        });

        await BleClient.connect(device.deviceId, (id) => {
            console.log(`Device ${id} disconnected`);
            connectedDeviceId = null;
            if (onDisconnect) onDisconnect();
        });

        connectedDeviceId = device.deviceId;
        return device;
    } catch (error) {
        console.error('Connection aborted or failed', error);
        throw error;
    }
};

export const disconnectBadge = async () => {
    if (connectedDeviceId) {
        await BleClient.disconnect(connectedDeviceId);
        connectedDeviceId = null;
    }
};

/**
 * Sends the 1-bit image buffer to the badge in chunks.
 * @param {Uint8Array} buffer 15,000 byte buffer
 * @param {Function} onProgress callback for progress (0 to 1)
 */
export const sendImageToBadge = async (buffer, onProgress) => {
    if (!connectedDeviceId) {
        throw new Error('Not connected to a badge.');
    }

    const totalChunks = Math.ceil(buffer.length / CHUNK_SIZE);
    
    // Send a start command or we can just stream immediately
    // For this generic implementation, we assume the badge expects raw sequential bytes
    // written to the characteristic.
    
    for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, buffer.length);
        const chunk = buffer.slice(start, end);
        
        const dataView = numbersToDataView(Array.from(chunk));
        
        // Write without response is faster, but write is safer
        await BleClient.write(
            connectedDeviceId,
            BADGE_SERVICE_UUID,
            DISPLAY_CHAR_UUID,
            dataView
        );

        if (onProgress) {
            onProgress((i + 1) / totalChunks);
        }
        
        // Slight delay to prevent buffer overflow on the peripheral
        await new Promise(r => setTimeout(r, 10));
    }
};
