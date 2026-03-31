package ch.kopolinfo.mailprocessor.backend.nativehost

import java.io.EOFException
import java.io.InputStream
import java.io.OutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder

private const val HEADER_LENGTH = 4

class NativeMessagingCodec {
    fun readMessage(input: InputStream): String? {
        val header = input.readExactOrNull(HEADER_LENGTH) ?: return null
        val messageLength = ByteBuffer.wrap(header)
            .order(ByteOrder.LITTLE_ENDIAN)
            .int

        require(messageLength >= 0) { "Native message length must not be negative" }

        val payload = input.readExact(messageLength)
        return payload.toString(Charsets.UTF_8)
    }

    fun writeMessage(output: OutputStream, message: String) {
        val payload = message.toByteArray(Charsets.UTF_8)
        val header = ByteBuffer.allocate(HEADER_LENGTH)
            .order(ByteOrder.LITTLE_ENDIAN)
            .putInt(payload.size)
            .array()

        output.write(header)
        output.write(payload)
        output.flush()
    }

    private fun InputStream.readExact(length: Int): ByteArray {
        val bytes = ByteArray(length)
        var offset = 0

        while (offset < length) {
            val read = read(bytes, offset, length - offset)
            if (read < 0) {
                throw EOFException("Unexpected end of stream while reading native message")
            }
            offset += read
        }

        return bytes
    }

    private fun InputStream.readExactOrNull(length: Int): ByteArray? {
        val bytes = ByteArray(length)
        var offset = 0

        while (offset < length) {
            val read = read(bytes, offset, length - offset)
            if (read < 0) {
                return if (offset == 0) {
                    null
                } else {
                    throw EOFException("Unexpected end of stream while reading native message header")
                }
            }
            offset += read
        }

        return bytes
    }
}
