// The app's receipt service (device files, image manipulator).
import { deviceImages } from '@/platform/images';
import { deviceReceiptFiles } from '@/platform/receiptFiles';
import { createReceiptService } from '@/services/receiptService';

export const receipts = createReceiptService({ files: deviceReceiptFiles, images: deviceImages });
