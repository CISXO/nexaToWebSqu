import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // oracledb 는 CVD_STORAGE=oracle 일 때만 서버에서 지연 로딩한다. 번들링하지 않고 Node require 로 처리한다.
  serverExternalPackages: ["oracledb"],
};

export default nextConfig;
