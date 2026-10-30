// يخبر الواجهة أن البحث والقراءة على الخادم متاحان.
module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ ok: true, hasSearch: true, hasRead: true });
};
