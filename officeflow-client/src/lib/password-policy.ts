export const NEW_PASSWORD_BYTE_MESSAGE =
  "Mật khẩu tối đa 72 byte UTF-8; ký tự có dấu và emoji có thể chiếm nhiều byte.";

export function fitsNewPasswordBytes(value: string) {
  return new TextEncoder().encode(value).byteLength <= 72;
}
