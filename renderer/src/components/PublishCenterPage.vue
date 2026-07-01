<template>
  <section class="publish-center-placeholder">
    <div class="publish-center-placeholder__card">
      <strong>发布中心</strong>
      <span>项目主理人正在努力开发中</span>
    </div>
  </section>
</template>

<style scoped>
.publish-center-placeholder {
  display: flex;
  min-height: 100%;
  align-items: center;
  justify-content: center;
}

.publish-center-placeholder__card {
  display: flex;
  min-width: 320px;
  flex-direction: column;
  gap: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  padding: 32px 40px;
  background: rgba(14, 18, 30, 0.9);
  color: rgba(236, 241, 255, 0.92);
  text-align: center;
}

.publish-center-placeholder__card strong {
  font-size: 20px;
  font-weight: 700;
}

.publish-center-placeholder__card span {
  color: rgba(205, 214, 238, 0.72);
}
</style>
