<template>
  <AppHeader>
    <div class="app-body">
      <el-card class="feedback-card">
        <template #header>
          <div class="card-header">
            <el-icon><ChatDotRound /></el-icon>
            <span>{{ isAdmin ? '处理反馈' : '我的反馈' }}</span>
            <el-tag v-if="isAdmin" type="danger" size="small" class="pending-tag">
              待处理：{{ pendingCount }}
            </el-tag>
          </div>
        </template>

        <div v-if="isAdmin" class="filter-bar">
          <el-select v-model="filterStatus" placeholder="状态筛选" clearable size="default" style="width: 140px">
            <el-option label="待处理" value="pending" />
            <el-option label="处理中" value="processing" />
            <el-option label="已解决" value="resolved" />
            <el-option label="已拒绝" value="rejected" />
          </el-select>
          <el-select v-model="filterType" placeholder="类型筛选" clearable size="default" style="width: 140px">
            <el-option label="功能异常" value="bug" />
            <el-option label="产品建议" value="suggestion" />
            <el-option label="安全问题" value="security" />
            <el-option label="其他问题" value="other" />
          </el-select>
          <el-button :icon="Refresh" @click="loadList">刷新</el-button>
        </div>
        <div v-else class="filter-bar">
          <el-select v-model="filterType" placeholder="类型筛选" clearable size="default" style="width: 140px">
            <el-option label="功能异常" value="bug" />
            <el-option label="产品建议" value="suggestion" />
            <el-option label="安全问题" value="security" />
            <el-option label="其他问题" value="other" />
          </el-select>
          <el-button :icon="Refresh" @click="loadList">刷新</el-button>
        </div>

        <!-- Admin 视图：完整表格 + 操作列 -->
        <el-table v-if="isAdmin" :data="list" v-loading="loading" style="width: 100%">
          <el-table-column type="index" label="#" width="60" />
          <el-table-column prop="type" label="类型" width="100">
            <template #default="{ row }">
              <el-tag :type="typeTagMap[row.type]" size="small">{{ typeLabelMap[row.type] }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="status" label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="statusTagMap[row.status]" size="small">{{ statusLabelMap[row.status] }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="description" label="描述" min-width="240">
            <template #default="{ row }">
              <div class="desc-text">{{ row.description }}</div>
            </template>
          </el-table-column>
          <el-table-column prop="username" label="提交人" width="120">
            <template #default="{ row }">
              <span>{{ row.username || '匿名' }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="email" label="邮箱" width="180">
            <template #default="{ row }">
              <span v-if="row.email">{{ row.email }}</span>
              <span v-else style="color: #c0c4cc">-</span>
            </template>
          </el-table-column>
          <el-table-column prop="createdAt" label="提交时间" width="170">
            <template #default="{ row }">
              {{ formatTime(row.createdAt) }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="160" fixed="right">
            <template #default="{ row }">
              <el-button size="small" type="primary" link @click="openReplyDialog(row)">
                {{ row.status === 'pending' ? '处理' : '回复' }}
              </el-button>
              <el-button size="small" type="danger" link @click="handleDelete(row)">
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>

        <!-- 普通用户视图：可展开行 + 无操作列 -->
        <el-table v-else :data="list" v-loading="loading" style="width: 100%" row-key="id">
          <el-table-column type="expand" width="60">
            <template #default="{ row }">
              <div class="expand-content">
                <div class="expand-section">
                  <div class="expand-label">反馈描述</div>
                  <div class="expand-value desc-full">{{ row.description }}</div>
                </div>
                <div v-if="row.reply" class="expand-section">
                  <div class="expand-label">管理员回复</div>
                  <div class="expand-value reply-content">{{ row.reply }}</div>
                  <div class="reply-time">回复时间：{{ formatTime(row.updatedAt) }}</div>
                </div>
                <div v-else class="expand-section">
                  <div class="expand-label">管理员回复</div>
                  <div class="expand-value no-reply">暂无回复</div>
                </div>
              </div>
            </template>
          </el-table-column>
          <el-table-column type="index" label="#" width="60" />
          <el-table-column prop="type" label="类型" width="100">
            <template #default="{ row }">
              <el-tag :type="typeTagMap[row.type]" size="small">{{ typeLabelMap[row.type] }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="status" label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="statusTagMap[row.status]" size="small">{{ statusLabelMap[row.status] }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="description" label="描述" min-width="240">
            <template #default="{ row }">
              <div class="desc-text">{{ row.description }}</div>
            </template>
          </el-table-column>
          <el-table-column prop="createdAt" label="提交时间" width="170">
            <template #default="{ row }">
              {{ formatTime(row.createdAt) }}
            </template>
          </el-table-column>
          <el-table-column label="回复" width="100">
            <template #default="{ row }">
              <el-tag v-if="row.reply" type="success" size="small">已回复</el-tag>
              <el-tag v-else type="info" size="small">待回复</el-tag>
            </template>
          </el-table-column>
        </el-table>

        <div class="pagination">
          <el-pagination
            v-model:current-page="page"
            v-model:page-size="pageSize"
            :total="total"
            :page-sizes="[10, 20, 50, 100]"
            layout="total, sizes, prev, pager, next, jumper"
            background
            @size-change="loadList"
            @current-change="loadList"
          />
        </div>
      </el-card>
    </div>

    <!-- 处理/回复对话框（仅 admin） -->
    <el-dialog v-if="isAdmin" v-model="replyDialogVisible" title="处理反馈" width="560px">
      <el-form v-if="currentFeedback" label-width="80px">
        <el-form-item label="类型">
          <el-tag :type="typeTagMap[currentFeedback.type]" size="small">
            {{ typeLabelMap[currentFeedback.type] }}
          </el-tag>
        </el-form-item>
        <el-form-item label="描述">
          <div class="dialog-desc">{{ currentFeedback.description }}</div>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="replyStatus" style="width: 100%">
            <el-option label="待处理" value="pending" />
            <el-option label="处理中" value="processing" />
            <el-option label="已解决" value="resolved" />
            <el-option label="已拒绝" value="rejected" />
          </el-select>
        </el-form-item>
        <el-form-item label="回复">
          <el-input
            v-model="replyContent"
            type="textarea"
            :rows="4"
            placeholder="请输入回复内容（选填）"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="replyDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitReply">
          确定
        </el-button>
      </template>
    </el-dialog>
  </AppHeader>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, ChatDotRound } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import AppHeader from '@/components/layout/AppHeader.vue'
import { useUserStore } from '@/stores/user'
import {
  getFeedbackList,
  getFeedbackPendingCount,
  updateFeedbackStatus,
  deleteFeedback,
  type IFeedback,
  type FeedbackStatus,
  type FeedbackType,
} from '@/api/feedback'

const userStore = useUserStore()
const isAdmin = computed(() => userStore.isAdmin)

const loading = ref(false)
const list = ref<IFeedback[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const pendingCount = ref(0)
const filterStatus = ref<FeedbackStatus | ''>('')
const filterType = ref<FeedbackType | ''>('')

const replyDialogVisible = ref(false)
const currentFeedback = ref<IFeedback | null>(null)
const replyStatus = ref<FeedbackStatus>('processing')
const replyContent = ref('')
const submitting = ref(false)

const typeLabelMap: Record<FeedbackType, string> = {
  bug: '功能异常',
  suggestion: '产品建议',
  security: '安全问题',
  other: '其他问题',
}

const typeTagMap: Record<FeedbackType, string> = {
  bug: 'danger',
  suggestion: 'warning',
  security: 'info',
  other: '',
}

const statusLabelMap: Record<FeedbackStatus, string> = {
  pending: '待处理',
  processing: '处理中',
  resolved: '已解决',
  rejected: '已拒绝',
}

const statusTagMap: Record<FeedbackStatus, string> = {
  pending: 'danger',
  processing: 'warning',
  resolved: 'success',
  rejected: 'info',
}

async function loadPendingCount() {
  try {
    const res = await getFeedbackPendingCount()
    if (res?.data) {
      pendingCount.value = res.data.count
    }
  } catch {
    /* ignore */
  }
}

async function loadList() {
  loading.value = true
  try {
    const res = await getFeedbackList({
      page: page.value,
      pageSize: pageSize.value,
      status: isAdmin.value ? (filterStatus.value || undefined) : undefined,
      type: filterType.value || undefined,
    })
    if (res?.data) {
      list.value = res.data.items
      total.value = res.data.total
    }
  } finally {
    loading.value = false
  }
}

function formatTime(iso: string): string {
  return dayjs(iso).format('YYYY-MM-DD HH:mm')
}

function openReplyDialog(feedback: IFeedback) {
  currentFeedback.value = feedback
  replyStatus.value = feedback.status === 'pending' ? 'processing' : feedback.status
  replyContent.value = feedback.reply || ''
  replyDialogVisible.value = true
}

async function submitReply() {
  if (!currentFeedback.value) return
  submitting.value = true
  try {
    const res = await updateFeedbackStatus(
      currentFeedback.value.id,
      replyStatus.value,
      replyContent.value,
    )
    if (res?.code === 0) {
      ElMessage.success('操作成功')
      replyDialogVisible.value = false
      loadList()
      if (isAdmin.value) {
        loadPendingCount()
      }
    }
  } finally {
    submitting.value = false
  }
}

async function handleDelete(row: IFeedback) {
  try {
    await ElMessageBox.confirm('确定要删除这条反馈吗？', '删除确认', {
      type: 'warning',
      confirmButtonText: '确定',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }
  try {
    const res = await deleteFeedback(row.id)
    if (res?.code === 0) {
      ElMessage.success('删除成功')
      loadList()
      loadPendingCount()
    }
  } catch {
    /* ignore */
  }
}

onMounted(() => {
  loadList()
  if (isAdmin.value) {
    loadPendingCount()
  }
})
</script>

<style scoped lang="scss">
.feedback-card {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;

  .card-header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;

    .pending-tag {
      margin-left: 12px;
    }
  }
}

.filter-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  align-items: center;
}

.desc-text {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.5;
  color: #303133;
}

.pagination {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

.dialog-desc {
  width: 100%;
  padding: 10px 12px;
  background: #f5f7fa;
  border-radius: 6px;
  line-height: 1.6;
  color: #303133;
  white-space: pre-wrap;
  word-break: break-all;
}

.expand-content {
  padding: 16px 24px;
  background: #fafafa;
  border-radius: 8px;
  margin: 8px 0;

  .expand-section {
    margin-bottom: 16px;

    &:last-child {
      margin-bottom: 0;
    }

    .expand-label {
      font-size: 13px;
      font-weight: 600;
      color: #606266;
      margin-bottom: 8px;
    }

    .expand-value {
      font-size: 14px;
      color: #303133;
      line-height: 1.6;
    }

    .desc-full {
      white-space: pre-wrap;
      word-break: break-all;
      padding: 10px 12px;
      background: #fff;
      border-radius: 6px;
      border: 1px solid #ebeef5;
    }

    .reply-content {
      white-space: pre-wrap;
      word-break: break-all;
      padding: 10px 12px;
      background: #ecf5ff;
      border-radius: 6px;
      border: 1px solid #d9ecff;
      color: #409eff;
    }

    .reply-time {
      margin-top: 8px;
      font-size: 12px;
      color: #909399;
    }

    .no-reply {
      color: #909399;
      font-style: italic;
      padding: 10px 12px;
      background: #f4f4f5;
      border-radius: 6px;
    }
  }
}
</style>
