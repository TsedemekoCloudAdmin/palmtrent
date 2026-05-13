// services/storageService.js
const crypto = require('crypto');
const path = require('path');
const { getIntegrationConfig } = require('./integrationSettingsService');

class StorageService {
  constructor() {
    this.provider = process.env.STORAGE_PROVIDER || process.env.STORAGE_DRIVER || 'local';
    this.baseUrl = process.env.STORAGE_BASE_URL || '/uploads';

    // AWS S3 config (if using S3)
    this.s3Config = {
      bucket: process.env.AWS_S3_BUCKET || process.env.STORAGE_BUCKET,
      region: process.env.AWS_REGION || process.env.STORAGE_REGION || 'us-east-1',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || process.env.STORAGE_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || process.env.STORAGE_SECRET_ACCESS_KEY
    };

    // Cloudinary config (if using Cloudinary)
    this.cloudinaryConfig = {
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY,
      apiSecret: process.env.CLOUDINARY_API_SECRET
    };
  }

  async refreshConfig() {
    const config = await getIntegrationConfig('storage');
    this.provider = config.driver || process.env.STORAGE_PROVIDER || process.env.STORAGE_DRIVER || 'local';
    this.baseUrl = config.baseUrl || process.env.STORAGE_BASE_URL || '/uploads';
    this.s3Config = {
      bucket: config.bucket || process.env.AWS_S3_BUCKET || process.env.STORAGE_BUCKET,
      region: config.region || process.env.AWS_REGION || process.env.STORAGE_REGION || 'us-east-1',
      accessKeyId: config.accessKeyId || process.env.AWS_ACCESS_KEY_ID || process.env.STORAGE_ACCESS_KEY_ID,
      secretAccessKey: config.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY || process.env.STORAGE_SECRET_ACCESS_KEY
    };
    return this;
  }

  /**
   * Generate unique filename
   */
  generateFilename(originalName, prefix = '') {
    const timestamp = Date.now();
    const random = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(originalName);
    return `${prefix}${timestamp}-${random}${ext}`;
  }

  /**
   * Get upload URL for direct client upload (presigned URL for S3)
   */
  async getUploadUrl(filename, contentType, folder = 'general') {
    await this.refreshConfig();
    if (this.provider === 's3' && this.s3Config.bucket) {
      return this.getS3PresignedUrl(filename, contentType, folder);
    }

    // For local storage, return the upload endpoint
    return {
      uploadUrl: `/api/v1/uploads/${folder}`,
      method: 'POST',
      filename,
      fields: {}
    };
  }

  /**
   * Get S3 presigned URL for direct upload
   */
  async getS3PresignedUrl(filename, contentType, folder) {
    try {
      // Dynamic import for AWS SDK
      const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');

      const client = new S3Client({
        region: this.s3Config.region,
        credentials: {
          accessKeyId: this.s3Config.accessKeyId,
          secretAccessKey: this.s3Config.secretAccessKey
        }
      });

      const key = `${folder}/${filename}`;
      const command = new PutObjectCommand({
        Bucket: this.s3Config.bucket,
        Key: key,
        ContentType: contentType
      });

      const uploadUrl = await getSignedUrl(client, command, { expiresIn: 3600 });

      return {
        uploadUrl,
        method: 'PUT',
        key,
        publicUrl: `https://${this.s3Config.bucket}.s3.${this.s3Config.region}.amazonaws.com/${key}`
      };
    } catch (error) {
      console.error('Error generating S3 presigned URL:', error);
      throw error;
    }
  }

  async getSignedDownloadUrl(key, expiresIn = 900) {
    await this.refreshConfig();
    if (this.provider !== 's3' || !this.s3Config.bucket) {
      return { url: key, provider: 'local', expiresIn: null };
    }

    const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
    const client = new S3Client({
      region: this.s3Config.region,
      credentials: {
        accessKeyId: this.s3Config.accessKeyId,
        secretAccessKey: this.s3Config.secretAccessKey
      }
    });

    const command = new GetObjectCommand({ Bucket: this.s3Config.bucket, Key: key });
    return {
      url: await getSignedUrl(client, command, { expiresIn }),
      provider: 's3',
      expiresIn
    };
  }

  /**
   * Upload file to storage (server-side upload)
   */
  async uploadFile(fileBuffer, filename, contentType, folder = 'general') {
    await this.refreshConfig();
    if (this.provider === 's3' && this.s3Config.bucket) {
      return this.uploadToS3(fileBuffer, filename, contentType, folder);
    }

    if (this.provider === 'cloudinary' && this.cloudinaryConfig.cloudName) {
      return this.uploadToCloudinary(fileBuffer, filename, folder);
    }

    // Default: local storage simulation (in production, use actual file system)
    return this.simulateLocalUpload(filename, folder);
  }

  /**
   * Upload to S3
   */
  async uploadToS3(fileBuffer, filename, contentType, folder) {
    try {
      const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');

      const client = new S3Client({
        region: this.s3Config.region,
        credentials: {
          accessKeyId: this.s3Config.accessKeyId,
          secretAccessKey: this.s3Config.secretAccessKey
        }
      });

      const key = `${folder}/${filename}`;
      await client.send(new PutObjectCommand({
        Bucket: this.s3Config.bucket,
        Key: key,
        Body: fileBuffer,
        ContentType: contentType
      }));

      return {
        success: true,
        url: `https://${this.s3Config.bucket}.s3.${this.s3Config.region}.amazonaws.com/${key}`,
        key,
        provider: 's3'
      };
    } catch (error) {
      console.error('S3 upload error:', error);
      throw error;
    }
  }

  /**
   * Upload to Cloudinary
   */
  async uploadToCloudinary(fileBuffer, filename, folder) {
    try {
      const cloudinary = await import('cloudinary');

      cloudinary.v2.config({
        cloud_name: this.cloudinaryConfig.cloudName,
        api_key: this.cloudinaryConfig.apiKey,
        api_secret: this.cloudinaryConfig.apiSecret
      });

      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.v2.uploader.upload_stream(
          {
            folder: `palmtrent/${folder}`,
            public_id: path.parse(filename).name,
            resource_type: 'auto'
          },
          (error, result) => {
            if (error) {
              reject(error);
            } else {
              resolve({
                success: true,
                url: result.secure_url,
                publicId: result.public_id,
                provider: 'cloudinary'
              });
            }
          }
        );
        uploadStream.end(fileBuffer);
      });
    } catch (error) {
      console.error('Cloudinary upload error:', error);
      throw error;
    }
  }

  /**
   * Simulate local upload (for development)
   */
  simulateLocalUpload(filename, folder) {
    const url = `${this.baseUrl}/${folder}/${filename}`;
    return {
      success: true,
      url,
      provider: 'local'
    };
  }

  /**
   * Delete file from storage
   */
  async deleteFile(fileUrl) {
    await this.refreshConfig();
    if (this.provider === 's3') {
      return this.deleteFromS3(fileUrl);
    }

    if (this.provider === 'cloudinary') {
      return this.deleteFromCloudinary(fileUrl);
    }

    return { success: true };
  }

  /**
   * Delete from S3
   */
  async deleteFromS3(fileUrl) {
    try {
      const { S3Client, DeleteObjectCommand } = await import('@aws-sdk/client-s3');

      const key = fileUrl.split('.amazonaws.com/')[1];
      if (!key) return { success: false, error: 'Invalid URL' };

      const client = new S3Client({
        region: this.s3Config.region,
        credentials: {
          accessKeyId: this.s3Config.accessKeyId,
          secretAccessKey: this.s3Config.secretAccessKey
        }
      });

      await client.send(new DeleteObjectCommand({
        Bucket: this.s3Config.bucket,
        Key: key
      }));

      return { success: true };
    } catch (error) {
      console.error('S3 delete error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete from Cloudinary
   */
  async deleteFromCloudinary(publicId) {
    try {
      const cloudinary = await import('cloudinary');

      cloudinary.v2.config({
        cloud_name: this.cloudinaryConfig.cloudName,
        api_key: this.cloudinaryConfig.apiKey,
        api_secret: this.cloudinaryConfig.apiSecret
      });

      await cloudinary.v2.uploader.destroy(publicId);
      return { success: true };
    } catch (error) {
      console.error('Cloudinary delete error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get upload configuration for different use cases
   */
  getUploadConfig(type) {
    const configs = {
      'cargo_photo': {
        folder: 'cargo',
        maxSize: 10 * 1024 * 1024, // 10MB
        allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
        dimensions: { maxWidth: 2048, maxHeight: 2048 }
      },
      'signature': {
        folder: 'signatures',
        maxSize: 2 * 1024 * 1024, // 2MB
        allowedTypes: ['image/png', 'image/jpeg'],
        dimensions: { maxWidth: 800, maxHeight: 400 }
      },
      'document': {
        folder: 'documents',
        maxSize: 20 * 1024 * 1024, // 20MB
        allowedTypes: ['application/pdf', 'image/jpeg', 'image/png'],
        dimensions: null
      },
      'profile': {
        folder: 'profiles',
        maxSize: 5 * 1024 * 1024, // 5MB
        allowedTypes: ['image/jpeg', 'image/png'],
        dimensions: { maxWidth: 500, maxHeight: 500 }
      },
      'vehicle': {
        folder: 'vehicles',
        maxSize: 10 * 1024 * 1024,
        allowedTypes: ['image/jpeg', 'image/png'],
        dimensions: { maxWidth: 2048, maxHeight: 2048 }
      },
      'claim': {
        folder: 'claims',
        maxSize: 15 * 1024 * 1024,
        allowedTypes: ['image/jpeg', 'image/png', 'application/pdf'],
        dimensions: null
      }
    };

    return configs[type] || configs['cargo_photo'];
  }

  /**
   * Validate file before upload
   */
  validateFile(file, type) {
    const config = this.getUploadConfig(type);
    const errors = [];

    if (file.size > config.maxSize) {
      errors.push(`File size exceeds ${config.maxSize / (1024 * 1024)}MB limit`);
    }

    if (!config.allowedTypes.includes(file.mimetype)) {
      errors.push(`File type ${file.mimetype} is not allowed`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

module.exports = new StorageService();
