<template>
  <div class="connection-manager">
    <!-- 连接列表 -->
    <div class="conn-list">
      <el-table :data="connections" stripe size="small" @row-click="handleRowClick">
        <el-table-column prop="name" label="名称" />
        <el-table-column prop="host" label="主机" />
        <el-table-column prop="port" label="端口" width="80" />
        <el-table-column prop="username" label="用户名" />
        <el-table-column prop="database" label="默认数据库" />
        <el-table-column label="操作" width="180">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click.stop="handleTest(row as IConnection)">测试</el-button>
            <el-button size="small" link type="primary" @click.stop="handleEdit(row as IConnection)">编辑</el-button>
            <el-popconfirm title="确定删除此连接？" @confirm="handleDelete(row as IConnection)">
              <template #reference>
                <el-button size="small" link type="danger" @click.stop>删除</el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 新增/编辑表单 -->
    <el-divider />
    <el-form ref="formRef" :model="form" :rules="rules" label-width="100px" size="small">
      <el-form-item label="名称" prop="name">
        <el-input v-model="form.name" placeholder="连接名称" />
      </el-form-item>
      <el-form-item label="主机" prop="host">
        <el-input v-model="form.host" placeholder="localhost" />
      </el-form-item>
      <el-form-item label="端口" prop="port">
        <el-input-number v-model="form.port" :min="1" :max="65535" />
      </el-form-item>
      <el-form-item label="用户名" prop="username">
        <el-input v-model="form.username" placeholder="root" />
      </el-form-item>
      <el-form-item label="密码" prop="password">
        <el-input v-model="form.password" type="password" show-password placeholder="密码" />
      </el-form-item>
      <el-form-item label="默认数据库">
        <el-input v-model="form.database" placeholder="可选" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="handleSubmit">
          {{ editingId ? '更新' : '添加' }}
        </el-button>
        <el-button @click="handleTestForm">测试连接</el-button>
        <el-button v-if="editingId" @click="resetForm">取消</el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { useConnectionStore } from '@/stores/connection'
import type { IConnection, IConnectionForm } from '@/api/connection'

const emit = defineEmits<{
  'close': []
}>()

const connectionStore = useConnectionStore()
const connections = computed(() => connectionStore.connections)

const formRef = ref<FormInstance>()
const editingId = ref('')
const form = ref<IConnectionForm>({
  name: '',
  host: 'localhost',
  port: 3306,
  username: 'root',
  password: '',
  database: '',
})

const rules: FormRules = {
  name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
  host: [{ required: true, message: '请输入主机', trigger: 'blur' }],
  port: [{ required: true, message: '请输入端口', trigger: 'blur' }],
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}

onMounted(() => {
  connectionStore.fetchConnections()
})

function handleRowClick(row: IConnection) {
  connectionStore.setActiveConnection(row)
}

async function handleTest(row: IConnection) {
  try {
    await connectionStore.testSavedConnection(row.id)
    ElMessage.success('连接成功')
  } catch {
    // 错误已在拦截器中处理
  }
}

function handleEdit(row: IConnection) {
  editingId.value = row.id
  form.value = {
    name: row.name,
    host: row.host,
    port: row.port,
    username: row.username,
    password: '', // 不回显密码
    database: row.database || '',
  }
}

async function handleDelete(row: IConnection) {
  await connectionStore.removeConnection(row.id)
  ElMessage.success('删除成功')
}

async function handleTestForm() {
  try {
    await connectionStore.testConnection(form.value)
    ElMessage.success('连接成功')
  } catch {
    // 错误已在拦截器中处理
  }
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  if (editingId.value) {
    await connectionStore.editConnection(editingId.value, form.value)
    ElMessage.success('更新成功')
  } else {
    await connectionStore.addConnection(form.value)
    ElMessage.success('添加成功')
  }
  resetForm()
}

function resetForm() {
  editingId.value = ''
  form.value = {
    name: '',
    host: 'localhost',
    port: 3306,
    username: 'root',
    password: '',
    database: '',
  }
  formRef.value?.resetFields()
}
</script>

<style scoped lang="scss">
.connection-manager {
  .conn-list {
    max-height: 300px;
    overflow-y: auto;
  }
}
</style>
