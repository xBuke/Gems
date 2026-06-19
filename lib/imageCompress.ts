import * as ImageManipulator from 'expo-image-manipulator'
import * as FileSystem from 'expo-file-system/legacy'

export const compressImage = async (uri: string): Promise<string> => {
  try {
    const originalInfo = await FileSystem.getInfoAsync(uri)
    const originalSize = originalInfo.exists ? originalInfo.size : 0

    const imageInfo = await ImageManipulator.manipulateAsync(uri, [], {})
    const originalWidth = imageInfo.width

    const actions = []
    if (originalWidth > 1080) {
      actions.push({ resize: { width: 1080 } })
    }

    const result = await ImageManipulator.manipulateAsync(
      uri,
      actions,
      { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG }
    )

    const compressedInfo = await FileSystem.getInfoAsync(result.uri)
    const compressedSize = compressedInfo.exists ? compressedInfo.size : 0

    console.log('Compression check:', { originalSize, compressedSize })

    // If compression didn't actually help, just use the original
    if (compressedSize >= originalSize) {
      console.log('Compressed was not smaller, using original')
      return uri
    }

    return result.uri
  } catch (error) {
    console.log('Image compression failed, using original:', error)
    return uri
  }
}
