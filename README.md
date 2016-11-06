实践一下nodejs的shadowsocks

# 说明
先完成`aes-256-cfb`算法的加解密，只针对ipv4做适配，暂不支持ipv6.

1. 运行`lib/ss-local.js`开启本地ss

  ```
  node lib/ss-local.js
  ```
 
2. 运行`lib/ss-server.js`开启ss服务，用于请求真正的地址

  ```
  node lib/ss-server.js
  ```
  
3. 测试：
  
  ```
   curl --socks5-hostname 127.0.0.1:1337 http://www.baidu.com
  ```

# 参考
1. [shadowsocks-nodejs](https://github.com/shadowsocks/shadowsocks-nodejs)
2. [socks5-client](https://github.com/mattcg/socks5-client)