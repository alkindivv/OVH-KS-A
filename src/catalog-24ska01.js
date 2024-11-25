const catalog24ska01 = {
  planCode: "24ska01",
  invoiceName: "KS-A | Intel i7-6700k",
  mandatory_addons: {
    storage: "softraid-1x480ssd-24ska01",
    memory: "ram-64g-noecc-2133-24ska01",
    bandwidth: "bandwidth-100-24sk",
  },
  datacenters: ["gra", "sbg", "rbx", "bhs", "waw", "fra", "lon"],
  configurations: {
    dedicated_os: "none_64.en",
    region: "canada",
  },
  pricing: {
    installation: 560000000,
    monthly: 560000000,
  },
  quantity: {
    min: 1,
    max: 10,
  },
};

module.exports = catalog24ska01;
