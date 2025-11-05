import React from 'react';
import { mintLeafLogoSvgDataUri } from '../../../core/models/data';

const MintLeafLogo: React.FC<{ className?: string }> = ({ className = "h-12 w-12" }) => (
  <img 
    src={mintLeafLogoSvgDataUri}
    alt="MintLeaf Logo"
    className={className}
  />
);

export default MintLeafLogo;