import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
})

export function generateSignedFileUrl(
  publicId: string,
  resourceType: 'image' | 'raw' | 'video' = 'raw'
) {
  return cloudinary.url(publicId, {
    resource_type: resourceType,
    type: 'authenticated',
    sign_url: true,
    secure: true,
  })
}

export function generatePrivateDownloadUrl(
  publicId: string,
  format = 'pdf',
  resourceType: 'image' | 'raw' = 'image'
) {
  return cloudinary.utils.private_download_url(publicId, format, {
    resource_type: resourceType,
    type: 'authenticated',
    attachment: false,
  })
}

export default cloudinary