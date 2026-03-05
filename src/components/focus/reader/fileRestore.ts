export async function restoreNodeFile(nodeId: number, file: File): Promise<{ success: boolean }> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`/api/nodes/${nodeId}/file/restore`, {
    method: 'POST',
    body: formData,
  });

  const json = await response.json().catch(() => ({}));
  if (!response.ok || !json.success) {
    throw new Error(json.error || `Failed to restore file (${response.status})`);
  }

  return { success: true };
}
