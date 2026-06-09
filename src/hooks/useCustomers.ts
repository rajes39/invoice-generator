import { useQuery, keepPreviousData } from '@tanstack/react-query';
import customerService from '../services/customerService';

export function useCustomers({ search = '', page = 1, pageSize = 25 } = {}) {
  return useQuery({
    queryKey: ['customers', { search, page, pageSize }],
    queryFn: async () => {
      const res = await customerService.fetchCustomers({ search, page, pageSize });
      return res;
    },
    placeholderData: keepPreviousData,
  });
}

export default useCustomers;
