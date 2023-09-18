
- [x] re-build without jack - was `cargo update` issue...
- [ ] check simple test with fresh lib install
  - in test: 
```
Failed to open client because of error: ClientError(FAILURE | SERVER_FAILED)
Failed to open client because of error: ClientError(FAILURE | SERVER_FAILED)
thread '<unnamed>' panicked at 'error while querying config: DeviceNotAvailable', /home/pi/.cargo/registry/src/index.crates.io-1cd66030c949c28d/web-audio-api-0.33.0/src/io/cpal.rs:147:14
```
  - same in nina

- [ ] install jack, cf. https://madskjeldgaard.dk/posts/raspi4-notes/

