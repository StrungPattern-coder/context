#!/usr/bin/env python3
"""
Generate PNG icons for the RAL Chrome extension.
Run this script to create the required icon files.
"""

from __future__ import annotations

import os
import struct
import zlib
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    pass

# Try to import PIL (optional dependency)
HAS_PIL = False
Image: Any = None
ImageDraw: Any = None
ImageFont: Any = None

try:
    from PIL import Image, ImageDraw, ImageFont  # type: ignore[import-not-found]
    HAS_PIL = True
except ImportError:
    pass


def is_inside_rounded_rect(x: int, y: int, width: int, height: int, radius: int) -> bool:
    """Check if point is inside a rounded rectangle."""
    # Check corners
    if x < radius and y < radius:
        return (x - radius) ** 2 + (y - radius) ** 2 <= radius ** 2
    if x >= width - radius and y < radius:
        return (x - (width - radius)) ** 2 + (y - radius) ** 2 <= radius ** 2
    if x < radius and y >= height - radius:
        return (x - radius) ** 2 + (y - (height - radius)) ** 2 <= radius ** 2
    if x >= width - radius and y >= height - radius:
        return (x - (width - radius)) ** 2 + (y - (height - radius)) ** 2 <= radius ** 2
    return True


def create_icon_with_pil(size: int, output_path: str) -> None:
    """Create a gradient icon with 'R' letter using PIL."""
    if not HAS_PIL:
        print(f"PIL not available, skipping {output_path}")
        return
    
    # Create image with gradient
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Create gradient background
    for y in range(size):
        for x in range(size):
            # Gradient from #38bdf8 to #818cf8
            ratio = (x + y) / (2 * size)
            r = int(56 + (129 - 56) * ratio)
            g = int(189 + (140 - 189) * ratio)
            b = int(248 + (248 - 248) * ratio)
            
            # Check if inside rounded rect
            corner_radius = size // 4
            if is_inside_rounded_rect(x, y, size, size, corner_radius):
                img.putpixel((x, y), (r, g, b, 255))
    
    # Draw 'R' letter
    font_size = int(size * 0.6)
    font = None
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", font_size)
    except (OSError, IOError):
        try:
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size)
        except (OSError, IOError):
            font = ImageFont.load_default()
    
    # Center the letter
    text = "R"
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    x_pos = (size - text_width) // 2
    y_pos = (size - text_height) // 2 - bbox[1]
    
    draw.text((x_pos, y_pos), text, fill=(255, 255, 255, 255), font=font)
    
    img.save(output_path, 'PNG')
    print(f"Created: {output_path}")


def create_simple_icon(size: int, output_path: str) -> None:
    """Create a simple colored PNG icon without PIL."""
    width = height = size
    
    # Gradient color based on position (simplified)
    def pixel_color(x: int, y: int) -> tuple[int, int, int, int]:
        ratio = (x + y) / (2 * size)
        r = int(56 + (129 - 56) * ratio)
        g = int(189 + (140 - 189) * ratio)
        b = 248
        return (r, g, b, 255)
    
    # Create raw pixel data
    raw_data: list[int] = []
    for y in range(height):
        raw_data.append(0)  # Filter byte
        for x in range(width):
            r, g, b, a = pixel_color(x, y)
            raw_data.extend([r, g, b, a])
    
    raw_bytes = bytes(raw_data)
    
    def png_chunk(chunk_type: bytes, data: bytes) -> bytes:
        chunk_len = struct.pack('>I', len(data))
        chunk_crc = struct.pack('>I', zlib.crc32(chunk_type + data) & 0xffffffff)
        return chunk_len + chunk_type + data + chunk_crc
    
    # PNG signature
    signature = b'\x89PNG\r\n\x1a\n'
    
    # IHDR chunk
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    ihdr = png_chunk(b'IHDR', ihdr_data)
    
    # IDAT chunk
    compressed = zlib.compress(raw_bytes, 9)
    idat = png_chunk(b'IDAT', compressed)
    
    # IEND chunk
    iend = png_chunk(b'IEND', b'')
    
    with open(output_path, 'wb') as f:
        f.write(signature + ihdr + idat + iend)
    
    print(f"Created: {output_path}")


def main() -> None:
    """Generate icons in all required sizes."""
    # Get script directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    icons_dir = os.path.join(script_dir, 'icons')
    
    # Ensure icons directory exists
    os.makedirs(icons_dir, exist_ok=True)
    
    sizes = [16, 48, 128]
    
    for size in sizes:
        output_path = os.path.join(icons_dir, f'icon{size}.png')
        
        if HAS_PIL:
            create_icon_with_pil(size, output_path)
        else:
            create_simple_icon(size, output_path)
    
    print("\n✅ Icons generated successfully!")
    print("\nNext steps:")
    print("1. Open chrome://extensions/")
    print("2. Enable 'Developer mode'")
    print("3. Click 'Load unpacked'")
    print("4. Select this extension folder")


if __name__ == '__main__':
    main()
