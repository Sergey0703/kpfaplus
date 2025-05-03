import { WebPartContext } from "@microsoft/sp-webpart-base";
import { HttpClient, HttpClientResponse } from "@microsoft/sp-http";

export interface IDepartment {
  ID: number;
  Title: string;
  Deleted: boolean;
  LeaveExportFolder: string;
  DayOfStartWeek: number;
  TypeOfSRS: number;
  EnterLunchTime: boolean;
  Manager: {
    Id: number;
    Value: string;
  };
}

// Interface for Power Automate flow request parameters
export interface IFlowRequestParams {
  CurrentUserID: string;
  [key: string]: string | number | boolean;
}

// Interface for Power Automate flow response
export interface IFlowResponse {
  listdata: string;
  [key: string]: string | number | boolean | object;
}

// Interface for parsed record from Flow
export interface IFlowRecord {
  ID: string | number;
  Title: string;
  Deleted: string | number | boolean;
  LeaveExportFolder: string;
  DayOfStartWeek: string | number;
  TypeOfSRS: string | number;
  EnterLunchTime: string | number | boolean;
  Manager: {
    Id: string | number;
    Value: string;
  };
  [key: string]: any;
}

export class DepartmentService {
  private context: WebPartContext;
  private logSource: string = "DepartmentService";

  constructor(context: WebPartContext) {
    this.context = context;
  }

  /**
   * Fetches department list from Power Automate Flow
   * @returns Promise with department data
   */
  public async fetchDepartments(): Promise<IDepartment[]> {
    try {
      this.logInfo("Starting fetchDepartments");
      
      // Prepare data for Power Automate Flow
      const requestData: IFlowRequestParams = {
        CurrentUserID: this.context.pageContext.user.email
      };

      // Call Power Automate Flow via HTTP request
      const response = await this.callPowerAutomateFlow("FetchStaffGroups", requestData);
      
      if (!response || !response.listdata) {
        this.logError("No data returned from flow");
        return [];
      }

      // Parse the response data
      return this.parseDepartments(response.listdata);
    } catch (error) {
      this.logError(`Error fetching departments: ${error}`);
      throw error;
    }
  }

  /**
   * Call Power Automate Flow via HTTP request
   * @param flowName Name of the flow to call
   * @param data Data to pass to the flow
   */
  private async callPowerAutomateFlow(flowName: string, data: IFlowRequestParams): Promise<IFlowResponse> {
    try {
      this.logInfo(`Calling flow: ${flowName}`);
      
      // In a real implementation, you would get this URL from configuration
      // This is a sample URL format for demo purposes
      const flowUrl = `https://prod-00.westus.logic.azure.com/workflows/{FLOW-GUID}/triggers/manual/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun`;
      
      // HTTP request options
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      };

      // Call the flow using the HttpClient from SPFx
      const response: HttpClientResponse = await this.context.httpClient.post(
        flowUrl,
        HttpClient.configurations.v1,
        requestOptions
      );

      // Check if response is OK
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! Status: ${response.status}, Details: ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      this.logError(`Error calling flow ${flowName}: ${error}`);
      throw error;
    }
  }

  /**
   * Parse the departments data from the flow response
   * @param listdata JSON string with list data
   * @returns Array of department objects
   */
  private parseDepartments(listdata: string): IDepartment[] {
    try {
      this.logInfo("Parsing department data");
      
      // Parse JSON string to object
      const parsedData = JSON.parse(listdata);
      
      if (!Array.isArray(parsedData)) {
        this.logError("Parsed data is not an array");
        return [];
      }
      
      // Map the records to the expected format using a for loop for ES5 compatibility
      const departments: IDepartment[] = [];
      
      for (let i = 0; i < parsedData.length; i++) {
        const record: IFlowRecord = parsedData[i];
        departments.push({
          ID: Number(record.ID),
          Title: String(record.Title),
          Deleted: Boolean(record.Deleted),
          LeaveExportFolder: String(record.LeaveExportFolder),
          DayOfStartWeek: Number(record.DayOfStartWeek),
          TypeOfSRS: Number(record.TypeOfSRS),
          EnterLunchTime: Boolean(record.EnterLunchTime),
          Manager: {
            Id: Number(record.Manager.Id),
            Value: String(record.Manager.Value)
          }
        });
      }
      
      return departments;
    } catch (error) {
      this.logError(`Error parsing departments: ${error}`);
      return [];
    }
  }

  /**
   * Helper method to log info messages
   * @param message Message to log
   */
  private logInfo(message: string): void {
    console.log(`[${this.logSource}] ${message}`);
  }

  /**
   * Helper method to log error messages
   * @param message Error message to log
   */
  private logError(message: string): void {
    console.error(`[${this.logSource}] ${message}`);
  }
}