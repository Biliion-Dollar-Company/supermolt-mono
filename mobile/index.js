// Polyfills MUST be imported first before anything else
import 'react-native-get-random-values';
import { Buffer } from 'buffer';
global.Buffer = Buffer;

// Then import expo-router entry
import 'expo-router/entry';
