import { Image, StyleSheet } from 'react-native';
import adsupLogo from '../../../assets/brand/adsup-logo.png';

export const BrandLogo = ({ size = 72 }: { size?: number }) => (
  <Image
    accessibilityLabel="ADSUP Agency CRM"
    source={adsupLogo}
    resizeMode="contain"
    style={[styles.logo, { width: size, height: size, borderRadius: size / 2 }]}
  />
);

const styles = StyleSheet.create({
  logo: {
    backgroundColor: '#FFFFFF',
  },
});
