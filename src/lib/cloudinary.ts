import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export function generateSignedFileUrl(
  publicId: string,
  resourceType: 'image' | 'raw' | 'video' = 'raw'
) {
  return cloudinary.utils.private_download_url(publicId, 'file', {
    resource_type: resourceType,
    type: 'upload',
    expires_at: Math.floor(Date.now() / 1000) + 60 * 5,
  })
}

export default cloudinary